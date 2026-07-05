import { Router } from 'express'
import multer from 'multer'
import axios from 'axios'
import db from '../db/init.js'
import { authMiddleware } from '../middleware/auth.js'

export const router = Router()

router.use(authMiddleware)

// 获取推送任务列表（支持按公司筛选）
router.get('/', (req, res) => {
  const { companyId } = req.query
  let tasks

  if (companyId) {
    tasks = db.prepare('SELECT * FROM push_tasks WHERE company_id = ? ORDER BY push_date ASC, push_time ASC').all(companyId)
  } else if (req.user.role === 'superadmin') {
    tasks = db.prepare('SELECT * FROM push_tasks ORDER BY push_date ASC, push_time ASC').all()
  } else {
    tasks = db.prepare('SELECT * FROM push_tasks WHERE company_id = ? ORDER BY push_date ASC, push_time ASC').all(req.user.companyId)
  }

  res.json({ data: tasks })
})

// 新增推送任务
router.post('/', (req, res) => {
  const { companyId, companyName, title, pushDate, pushTime, bookName, content, webhook, status, execStatus } = req.body

  if (!companyId || !pushDate || !pushTime || !bookName || !content) {
    return res.status(400).json({ message: '公司ID、推送日期、推送时间、书籍名称和书籍内容不能为空' })
  }

  // 权限检查：操作员只能给自家公司创建任务
  if (req.user.role !== 'superadmin' && req.user.companyId !== companyId) {
    return res.status(403).json({ message: '无权为其他公司创建推送任务' })
  }

  const result = db.prepare(
    `INSERT INTO push_tasks (company_id, company_name, title, push_date, push_time, book_name, content, webhook, exec_status, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    companyId,
    companyName || '',
    title || '今日读书分享',
    pushDate,
    pushTime,
    bookName,
    content,
    webhook || '',
    execStatus || 'pending',
    status || 'active'
  )

  const task = db.prepare('SELECT * FROM push_tasks WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ data: task, message: '新增成功' })
})

// 编辑推送任务
router.put('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM push_tasks WHERE id = ?').get(req.params.id)
  if (!task) return res.status(404).json({ message: '推送任务不存在' })

  // 权限检查
  if (req.user.role !== 'superadmin' && req.user.companyId !== task.company_id) {
    return res.status(403).json({ message: '无权修改其他公司的推送任务' })
  }

  const { title, pushDate, pushTime, bookName, content, webhook, status, execStatus } = req.body
  db.prepare(
    `UPDATE push_tasks SET title = ?, push_date = ?, push_time = ?, book_name = ?, content = ?, webhook = ?, exec_status = ?, status = ? WHERE id = ?`
  ).run(
    title ?? task.title,
    pushDate ?? task.push_date,
    pushTime ?? task.push_time,
    bookName ?? task.book_name,
    content ?? task.content,
    webhook ?? task.webhook,
    execStatus ?? task.exec_status,
    status ?? task.status,
    req.params.id
  )

  const updated = db.prepare('SELECT * FROM push_tasks WHERE id = ?').get(req.params.id)
  res.json({ data: updated, message: '修改成功' })
})

// 删除推送任务
router.delete('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM push_tasks WHERE id = ?').get(req.params.id)
  if (!task) return res.status(404).json({ message: '推送任务不存在' })

  if (req.user.role !== 'superadmin' && req.user.companyId !== task.company_id) {
    return res.status(403).json({ message: '无权删除其他公司的推送任务' })
  }

  db.prepare('DELETE FROM push_tasks WHERE id = ?').run(req.params.id)
  res.json({ message: '删除成功' })
})

// 批量删除推送任务
router.post('/batch-delete', (req, res) => {
  const { ids } = req.body
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: '请选择要删除的任务' })
  }

  // 操作员只能删除本公司的任务
  const deleteStmt = db.prepare('DELETE FROM push_tasks WHERE id = ?')
  const countStmt = db.prepare('SELECT company_id FROM push_tasks WHERE id = ?')

  let deleted = 0
  const transaction = db.transaction(() => {
    for (const id of ids) {
      const task = countStmt.get(id)
      if (!task) continue
      if (req.user.role !== 'superadmin' && req.user.companyId !== task.company_id) continue
      deleteStmt.run(id)
      deleted++
    }
  })
  transaction()

  res.json({ message: `成功删除 ${deleted} 条推送任务` })
})

// 手动触发推送
router.post('/:id/trigger', (req, res) => {
  const task = db.prepare('SELECT * FROM push_tasks WHERE id = ?').get(req.params.id)
  if (!task) return res.status(404).json({ message: '推送任务不存在' })

  if (req.user.role !== 'superadmin' && req.user.companyId !== task.company_id) {
    return res.status(403).json({ message: '无权触发其他公司的推送任务' })
  }

  // 实时从公司表读取最新 webhook（避免任务中存的是旧地址）
  const company = db.prepare('SELECT webhook FROM companies WHERE id = ?').get(task.company_id)
  const webhookUrl = company?.webhook || task.webhook

  if (!webhookUrl) {
    return res.status(400).json({ message: '该任务未配置Webhook地址，无法推送' })
  }

  const pushContent = `📖 ${task.book_name}\n\n${task.content}`

  axios.post(webhookUrl, {
    msgtype: 'text',
    text: { content: pushContent }
  }, {
    headers: { 'Content-Type': 'application/json; charset=UTF-8' }
  })
  .then(() => {
    db.prepare('UPDATE push_tasks SET exec_status = ? WHERE id = ?').run('pushed', req.params.id)
    const updated = db.prepare('SELECT * FROM push_tasks WHERE id = ?').get(req.params.id)
    res.json({ data: updated, message: '推送成功！' })
  })
  .catch((err) => {
    const wxError = err.response?.data
    console.error('Webhook推送失败:', wxError || err.message)
    res.status(500).json({
      message: '推送失败',
      detail: wxError || err.message
    })
  })
})

// Excel批量导入推送任务
router.post('/import/:companyId', (req, res) => {
  const { tasks } = req.body
  const companyId = Number(req.params.companyId)

  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ message: '导入数据不能为空' })
  }

  // 获取公司信息
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId)
  if (!company) return res.status(404).json({ message: '公司不存在' })

  const insert = db.prepare(
    `INSERT INTO push_tasks (company_id, company_name, title, push_date, push_time, book_name, content, webhook, exec_status, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  const transaction = db.transaction((items) => {
    const inserted = []
    for (const item of items) {
      const result = insert.run(
        companyId,
        company.name,
        '今日读书分享',
        item.pushDate,
        item.pushTime || '00:00',
        item.bookName,
        item.content,
        company.webhook,
        'pending',
        'active'
      )
      inserted.push(db.prepare('SELECT * FROM push_tasks WHERE id = ?').get(result.lastInsertRowid))
    }
    return inserted
  })

  const inserted = transaction(tasks)
  res.status(201).json({ data: inserted, message: `成功导入 ${inserted.length} 条推送任务` })
})
