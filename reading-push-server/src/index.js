import express from 'express'
import cors from 'cors'
import axios from 'axios'
import { router as authRouter } from './routes/auth.js'
import { router as companyRouter } from './routes/companies.js'
import { router as userRouter } from './routes/users.js'
import { router as pushTaskRouter } from './routes/pushTasks.js'
import { initDB, default as db } from './db/init.js'

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
initDB()
app.listen(PORT, () => {
  console.log(`📚 读书推送后端服务已启动: http://localhost:${PORT}`)
  console.log(`   API地址: http://localhost:${PORT}/api`)
  console.log(`   CORS允许来源: ${ALLOWED_ORIGINS.join(', ')}`)
})

// ============ 自动推送调度器 ============
async function doScheduledCheck() {
  try {
    const now = new Date()
    const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    // 只推送当天的到期任务：推送日期 = 今天 且 推送时间 <= 当前时间
    // 同时要求所属公司状态为生效
    const tasks = db.prepare(`
      SELECT pt.* FROM push_tasks pt
      INNER JOIN companies c ON pt.company_id = c.id
      WHERE pt.status = 'active'
        AND pt.exec_status = 'pending'
        AND c.status = 'active'
        AND pt.push_date = ?
        AND pt.push_time <= ?
    `).all(currentDate, currentTime)

    if (tasks.length === 0) return

    console.log(`  📤 发现 ${tasks.length} 条待推送任务需要执行... (当前时间: ${currentDate} ${currentTime})`)

    for (const task of tasks) {
      try {
        const company = db.prepare('SELECT webhook FROM companies WHERE id = ?').get(task.company_id)
        const webhookUrl = company?.webhook || task.webhook

        if (!webhookUrl) {
          console.error(`    ⚠️ 任务 #${task.id} 无Webhook地址，跳过`)
          continue
        }

        const pushContent = `📖 ${task.book_name}\n\n${task.content}`

        await axios.post(webhookUrl, {
          msgtype: 'text',
          text: { content: pushContent }
        }, {
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
          timeout: 10000
        })

        db.prepare("UPDATE push_tasks SET exec_status = 'pushed' WHERE id = ?").run(task.id)
        console.log(`    ✅ 任务 #${task.id} [${task.push_date} ${task.push_time}] ${task.book_name} 推送成功`)
      } catch (err) {
        const wxError = err.response?.data
        console.error(`    ❌ 任务 #${task.id} 推送失败:`, wxError || err.message)
      }
    }
  } catch (err) {
    console.error('  ❌ 调度器执行出错:', err.message)
  }
}

console.log('  ⏰ 自动推送调度器已启动，每60秒检查一次')
doScheduledCheck()
setInterval(doScheduledCheck, 60 * 1000)
