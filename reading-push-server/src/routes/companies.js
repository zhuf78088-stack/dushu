import { Router } from 'express'
import db from '../db/init.js'
import { authMiddleware, superAdminOnly } from '../middleware/auth.js'

export const router = Router()

// 所有公司路由需要登录
router.use(authMiddleware)

// 获取公司列表
router.get('/', (req, res) => {
  const companies = db.prepare('SELECT * FROM companies ORDER BY id ASC').all()
  res.json({ data: companies })
})

// 获取单个公司
router.get('/:id', (req, res) => {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id)
  if (!company) return res.status(404).json({ message: '公司不存在' })
  res.json({ data: company })
})

// 新增公司
router.post('/', superAdminOnly, (req, res) => {
  const { name, contact, phone, webhook, status } = req.body
  if (!name || !webhook) {
    return res.status(400).json({ message: '公司名称和Webhook地址不能为空' })
  }

  const result = db.prepare(
    'INSERT INTO companies (name, contact, phone, webhook, status) VALUES (?, ?, ?, ?, ?)'
  ).run(name, contact || '', phone || '', webhook, status || 'active')

  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ data: company, message: '新增成功' })
})

// 编辑公司
router.put('/:id', superAdminOnly, (req, res) => {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id)
  if (!company) return res.status(404).json({ message: '公司不存在' })

  const { name, contact, phone, webhook, status } = req.body
  db.prepare(
    'UPDATE companies SET name = ?, contact = ?, phone = ?, webhook = ?, status = ? WHERE id = ?'
  ).run(name || company.name, contact ?? company.contact, phone ?? company.phone, webhook ?? company.webhook, status ?? company.status, req.params.id)

  const updated = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id)
  res.json({ data: updated, message: '修改成功' })
})

// 删除公司（同时删除该公司下所有推送任务）
router.delete('/:id', superAdminOnly, (req, res) => {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id)
  if (!company) return res.status(404).json({ message: '公司不存在' })

  const taskCount = db.prepare('SELECT COUNT(*) as count FROM push_tasks WHERE company_id = ?').get(req.params.id).count

  db.transaction(() => {
    db.prepare('DELETE FROM push_tasks WHERE company_id = ?').run(req.params.id)
    db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id)
  })()

  res.json({ message: `删除成功，同时删除了 ${taskCount} 条推送任务` })
})
