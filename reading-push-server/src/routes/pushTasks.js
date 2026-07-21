import { Router } from 'express'
import multer from 'multer'
import axios from 'axios'
import { fetchWeather } from '../utils/weather.js'
import pool from '../db/mysql.js'
import { authMiddleware } from '../middleware/auth.js'

export const router = Router()

router.use(authMiddleware)

// 获取推送任务列表（支持按公司筛选）
router.get('/', async (req, res, next) => {
  try {
    const { companyId } = req.query
    let rows

    if (companyId) {
      const [result] = await pool.execute('SELECT * FROM push_tasks WHERE company_id = ? ORDER BY push_date ASC', [companyId])
      rows = result
    } else if (req.user.role === 'superadmin') {
      const [result] = await pool.execute('SELECT * FROM push_tasks ORDER BY push_date ASC')
      rows = result
    } else {
      // 操作员可查看自己管理的所有公司的任务
      const companyIds = req.user.companyIds || [req.user.companyId]
      if (companyIds.length === 0) {
        rows = []
      } else {
        const placeholders = companyIds.map(() => '?').join(',')
        const [result] = await pool.execute(
          `SELECT * FROM push_tasks WHERE company_id IN (${placeholders}) ORDER BY push_date ASC`,
          companyIds
        )
        rows = result
      }
    }

    res.json({ data: rows })
  } catch (err) {
    next(err)
  }
})

// 新增推送任务
router.post('/', async (req, res, next) => {
  try {
    const { companyId, companyName, title, pushTitle, pushDate, bookName, content, webhook, status, execStatus } = req.body

    if (!companyId || !pushDate || !bookName || !content) {
      return res.status(400).json({ message: '公司ID、推送日期、书籍名称和书籍内容不能为空' })
    }

    // 权限检查：操作员只能给自己管理的公司创建任务
    const allowedIds = req.user.companyIds || [req.user.companyId]
    if (req.user.role !== 'superadmin' && !allowedIds.includes(companyId)) {
      return res.status(403).json({ message: '无权为其他公司创建推送任务' })
    }

    const [result] = await pool.execute(
      `INSERT INTO push_tasks (company_id, company_name, title, push_title, push_date, book_name, content, webhook, exec_status, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        companyName || '',
        title || '今日读书分享',
        pushTitle || '【每日分享】',
        pushDate,
        bookName,
        content,
        webhook || '',
        execStatus || 'pending',
        status || 'active'
      ]
    )

    const [rows] = await pool.execute('SELECT * FROM push_tasks WHERE id = ?', [result.insertId])
    const task = rows[0]
    res.status(201).json({ data: task, message: '新增成功' })
  } catch (err) {
    next(err)
  }
})

// 编辑推送任务
router.put('/:id', async (req, res, next) => {
  try {
    const [taskRows] = await pool.execute('SELECT * FROM push_tasks WHERE id = ?', [req.params.id])
    const task = taskRows[0]
    if (!task) return res.status(404).json({ message: '推送任务不存在' })

    // 权限检查
    const allowedIds = req.user.companyIds || [req.user.companyId]
    if (req.user.role !== 'superadmin' && !allowedIds.includes(task.company_id)) {
      return res.status(403).json({ message: '无权修改其他公司的推送任务' })
    }

    const { title, pushTitle, pushDate, bookName, content, webhook, status, execStatus } = req.body
    await pool.execute(
      `UPDATE push_tasks SET title = ?, push_title = ?, push_date = ?, book_name = ?, content = ?, webhook = ?, exec_status = ?, status = ? WHERE id = ?`,
      [
        title ?? task.title,
        pushTitle ?? task.push_title,
        pushDate ?? task.push_date,
        bookName ?? task.book_name,
        content ?? task.content,
        webhook ?? task.webhook,
        execStatus ?? task.exec_status,
        status ?? task.status,
        req.params.id
      ]
    )

    const [updatedRows] = await pool.execute('SELECT * FROM push_tasks WHERE id = ?', [req.params.id])
    const updated = updatedRows[0]
    res.json({ data: updated, message: '修改成功' })
  } catch (err) {
    next(err)
  }
})

// 删除推送任务
router.delete('/:id', async (req, res, next) => {
  try {
    const [taskRows] = await pool.execute('SELECT * FROM push_tasks WHERE id = ?', [req.params.id])
    const task = taskRows[0]
    if (!task) return res.status(404).json({ message: '推送任务不存在' })

    const allowedIds = req.user.companyIds || [req.user.companyId]
    if (req.user.role !== 'superadmin' && !allowedIds.includes(task.company_id)) {
      return res.status(403).json({ message: '无权删除其他公司的推送任务' })
    }

    await pool.execute('DELETE FROM push_logs WHERE task_id = ?', [req.params.id])
    await pool.execute('DELETE FROM push_tasks WHERE id = ?', [req.params.id])
    res.json({ message: '删除成功' })
  } catch (err) {
    next(err)
  }
})

// 批量删除推送任务
router.post('/batch-delete', async (req, res, next) => {
  try {
    const { ids } = req.body
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: '请选择要删除的任务' })
    }

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      // 先查询所有待删除任务的 company_id，进行权限过滤
      const placeholders = ids.map(() => '?').join(',')
      const [allRows] = await conn.execute(
        `SELECT id, company_id FROM push_tasks WHERE id IN (${placeholders})`,
        ids
      )

      // 权限过滤：操作员只能删除本公司的任务
      const allowedCompanyIds = req.user.companyIds || [req.user.companyId]
      const allowedIds = allRows
        .filter(row => req.user.role === 'superadmin' || allowedCompanyIds.includes(row.company_id))
        .map(row => row.id)

      let deleted = 0
      if (allowedIds.length > 0) {
        const deletePlaceholders = allowedIds.map(() => '?').join(',')
        await conn.execute(
          `DELETE FROM push_logs WHERE task_id IN (${deletePlaceholders})`,
          allowedIds
        )
        const [result] = await conn.execute(
          `DELETE FROM push_tasks WHERE id IN (${deletePlaceholders})`,
          allowedIds
        )
        deleted = result.affectedRows
      }

      await conn.commit()
      res.json({ message: `成功删除 ${deleted} 条推送任务` })
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  } catch (err) {
    next(err)
  }
})

// 手动触发推送
router.post('/:id/trigger', async (req, res, next) => {
  try {
    const [taskRows] = await pool.execute('SELECT * FROM push_tasks WHERE id = ?', [req.params.id])
    const task = taskRows[0]
    if (!task) return res.status(404).json({ message: '推送任务不存在' })

    const allowedIds = req.user.companyIds || [req.user.companyId]
    if (req.user.role !== 'superadmin' && !allowedIds.includes(task.company_id)) {
      return res.status(403).json({ message: '无权触发其他公司的推送任务' })
    }

    // 实时从公司表读取最新 webhook（避免任务中存的是旧地址）
    const [companyRows] = await pool.execute('SELECT webhook, greeting, weather_enabled, weather_city FROM companies WHERE id = ?', [task.company_id])
    const company = companyRows[0]
    const webhookUrl = company?.webhook || task.webhook

    if (!webhookUrl) {
      return res.status(400).json({ message: '该任务未配置Webhook地址，无法推送' })
    }

    // 组装推送内容：开头语 + 天气预报 + 标题和内容
    let pushParts = []
    if (company?.greeting) {
      pushParts.push(company.greeting)
    }
    if (company?.weather_enabled && company?.weather_city) {
      const weatherText = await fetchWeather(company.weather_city)
      if (weatherText) {
        pushParts.push(weatherText)
      }
    }
    pushParts.push(task.push_title || '【每日分享】')
    pushParts.push(`📖 ${task.book_name}\n\n${task.content}`)
    const pushContent = pushParts.join('\n\n')

    try {
      await axios.post(webhookUrl, {
        msgtype: 'text',
        text: { content: pushContent }
      }, {
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        timeout: 10000
      })
    } catch (err) {
      const wxError = err.response?.data
      console.error('Webhook推送失败:', wxError || err.message)
      return res.status(500).json({
        message: '推送失败',
        detail: wxError || err.message
      })
    }

    await pool.execute('UPDATE push_tasks SET exec_status = ? WHERE id = ?', ['pushed', req.params.id])

    // 记录推送日志
    const logNow = new Date()
    const logDate = `${logNow.getFullYear()}-${String(logNow.getMonth() + 1).padStart(2, '0')}-${String(logNow.getDate()).padStart(2, '0')}`
    const logTime = `${String(logNow.getHours()).padStart(2, '0')}:${String(logNow.getMinutes()).padStart(2, '0')}:${String(logNow.getSeconds()).padStart(2, '0')}`
    await pool.execute(
      `INSERT INTO push_logs (task_id, company_id, company_name, push_date, push_time, book_name, status)
       VALUES (?, ?, ?, ?, ?, ?, 'success')`,
      [task.id, task.company_id, task.company_name, logDate, logTime, task.book_name]
    )

    const [updatedRows] = await pool.execute('SELECT * FROM push_tasks WHERE id = ?', [req.params.id])
    const updated = updatedRows[0]
    res.json({ data: updated, message: '推送成功！' })
  } catch (err) {
    next(err)
  }
})

// Excel批量导入推送任务
router.post('/import/:companyId', async (req, res, next) => {
  try {
    const { tasks } = req.body
    const companyId = Number(req.params.companyId)

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ message: '导入数据不能为空' })
    }

    // 获取公司信息
    const [companyRows] = await pool.execute('SELECT * FROM companies WHERE id = ?', [companyId])
    const company = companyRows[0]
    if (!company) return res.status(404).json({ message: '公司不存在' })

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const inserted = []
      for (const item of tasks) {
        const [result] = await conn.execute(
          `INSERT INTO push_tasks (company_id, company_name, title, push_title, push_date, book_name, content, webhook, exec_status, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            company.name,
            item.title || '今日读书分享',
            item.pushTitle || '【每日分享】',
            item.pushDate,
            item.bookName,
            item.content,
            company.webhook,
            'pending',
            'active'
          ]
        )

        const [rows] = await conn.execute('SELECT * FROM push_tasks WHERE id = ?', [result.insertId])
        inserted.push(rows[0])
      }

      await conn.commit()
      res.status(201).json({ data: inserted, message: `成功导入 ${inserted.length} 条推送任务` })
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  } catch (err) {
    next(err)
  }
})
