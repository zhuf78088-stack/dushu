import express from 'express'
import cors from 'cors'
import axios from 'axios'
import { fetchWeather } from './utils/weather.js'
import { router as authRouter } from './routes/auth.js'
import { router as companyRouter } from './routes/companies.js'
import { router as userRouter } from './routes/users.js'
import { router as pushTaskRouter } from './routes/pushTasks.js'
import { initDB, default as pool } from './db/mysql.js'

const app = express()
const PORT = process.env.PORT || 3000

// 中间件
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim())
app.use(cors({
  origin(origin, callback) {
    // 允许无 origin 的请求（如 curl、服务端调用）
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`))
    }
  },
  credentials: true
}))
app.use(express.json())

// 路由
app.use('/api/auth', authRouter)
app.use('/api/companies', companyRouter)
app.use('/api/users', userRouter)
app.use('/api/push-tasks', pushTaskRouter)

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('Server Error:', err)
  res.status(err.status || 500).json({ message: err.message || '服务器内部错误' })
})

// 初始化数据库并启动服务
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`📚 读书推送后端服务已启动: http://localhost:${PORT}`)
    console.log(`   API地址: http://localhost:${PORT}/api`)
    console.log(`   CORS允许来源: ${ALLOWED_ORIGINS.join(', ')}`)
  })

  // 调度器在数据库就绪后启动
  console.log('  ⏰ 自动推送调度器已启动，每60秒检查一次')
  doScheduledCheck()
  setInterval(doScheduledCheck, 60 * 1000)
}).catch(err => {
  console.error('❌ 数据库初始化失败:', err.message)
  process.exit(1)
})

// ============ 自动推送调度器 ============
async function doScheduledCheck() {
  try {
    const now = new Date()
    const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    // 只推送当天的到期任务：推送日期 = 今天 且 公司配置的推送时间 <= 当前时间
    // 同时要求所属公司状态为生效
    const [tasks] = await pool.execute(`
      SELECT pt.*, c.push_time, c.greeting, c.weather_enabled, c.weather_city FROM push_tasks pt
      INNER JOIN companies c ON pt.company_id = c.id
      WHERE pt.status = 'active'
        AND pt.exec_status = 'pending'
        AND c.status = 'active'
        AND pt.push_date = ?
        AND c.push_time <= ?
    `, [currentDate, currentTime])

    if (tasks.length === 0) return

    console.log(`  📤 发现 ${tasks.length} 条待推送任务需要执行... (当前时间: ${currentDate} ${currentTime})`)

    for (const task of tasks) {
      try {
        const [companyRows] = await pool.execute('SELECT webhook FROM companies WHERE id = ?', [task.company_id])
        const webhookUrl = companyRows[0]?.webhook || task.webhook

        if (!webhookUrl) {
          console.error(`    ⚠️ 任务 #${task.id} 无Webhook地址，跳过`)
          continue
        }

        // 组装推送内容：开头语 + 天气预报 + 标题和内容
        let pushParts = []
        if (task.greeting) {
          pushParts.push(task.greeting)
        }
        if (task.weather_enabled && task.weather_city) {
          const weatherText = await fetchWeather(task.weather_city)
          if (weatherText) {
            pushParts.push(weatherText)
          }
        }
        pushParts.push(task.push_title || '【每日分享】')
        pushParts.push(`📖 ${task.book_name}\n\n${task.content}`)
        const pushContent = pushParts.join('\n\n')

        await axios.post(webhookUrl, {
          msgtype: 'text',
          text: { content: pushContent }
        }, {
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
          timeout: 10000
        })

        await pool.execute("UPDATE push_tasks SET exec_status = 'pushed' WHERE id = ?", [task.id])

        // 记录推送成功日志
        await pool.execute(
          `INSERT INTO push_logs (task_id, company_id, company_name, push_date, push_time, book_name, status)
           VALUES (?, ?, ?, ?, ?, ?, 'success')`,
          [task.id, task.company_id, task.company_name, currentDate, currentTime, task.book_name]
        )
        console.log(`    ✅ 任务 #${task.id} [${task.push_date} ${task.push_time || currentTime}] ${task.book_name} 推送成功`)
      } catch (err) {
        const wxError = err.response?.data
        console.error(`    ❌ 任务 #${task.id} 推送失败:`, wxError || err.message)

        // 记录推送失败日志
        try {
          await pool.execute(
            `INSERT INTO push_logs (task_id, company_id, company_name, push_date, push_time, book_name, status, error_msg)
             VALUES (?, ?, ?, ?, ?, ?, 'failed', ?)`,
            [task.id, task.company_id, task.company_name, currentDate, currentTime, task.book_name, (wxError ? JSON.stringify(wxError) : err.message).substring(0, 1000)]
          )
        } catch (_) { /* 日志写入失败不中断调度 */ }
      }
    }
  } catch (err) {
    console.error('  ❌ 调度器执行出错:', err.message)
  }
}
