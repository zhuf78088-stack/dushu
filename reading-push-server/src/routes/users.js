import { Router } from 'express'
import db from '../db/init.js'
import { authMiddleware, superAdminOnly } from '../middleware/auth.js'

export const router = Router()

router.use(authMiddleware)

// 获取用户列表
router.get('/', (req, res) => {
  let users
  if (req.user.role === 'superadmin') {
    users = db.prepare('SELECT id, username, name, role, company_id, company_name, status, created_at FROM users ORDER BY id ASC').all()
  } else {
    // 操作员只能看到自己公司的用户
    users = db.prepare('SELECT id, username, name, role, company_id, company_name, status, created_at FROM users WHERE company_id = ? ORDER BY id ASC').all(req.user.companyId)
  }
  res.json({ data: users })
})

// 新增用户
router.post('/', superAdminOnly, (req, res) => {
  const { username, password, name, role, companyId, companyName, status } = req.body
  if (!username || !password || !name) {
    return res.status(400).json({ message: '用户名、密码和姓名不能为空' })
  }

  try {
    const result = db.prepare(
      'INSERT INTO users (username, password, name, role, company_id, company_name, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(username, password, name, role || 'operator', companyId || null, companyName || '-', status || 'active')

    const user = db.prepare('SELECT id, username, name, role, company_id, company_name, status, created_at FROM users WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json({ data: user, message: '新增成功' })
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ message: '用户名已存在' })
    }
    throw err
  }
})

// 编辑用户
router.put('/:id', superAdminOnly, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ message: '用户不存在' })

  const { username, password, name, role, companyId, companyName, status } = req.body
  if (password) {
    db.prepare('UPDATE users SET password = ?, name = ?, role = ?, company_id = ?, company_name = ?, status = ? WHERE id = ?')
      .run(password, name || user.name, role ?? user.role, companyId ?? user.company_id, companyName ?? user.company_name, status ?? user.status, req.params.id)
  } else {
    db.prepare('UPDATE users SET name = ?, role = ?, company_id = ?, company_name = ?, status = ? WHERE id = ?')
      .run(name || user.name, role ?? user.role, companyId ?? user.company_id, companyName ?? user.company_name, status ?? user.status, req.params.id)
  }

  const updated = db.prepare('SELECT id, username, name, role, company_id, company_name, status, created_at FROM users WHERE id = ?').get(req.params.id)
  res.json({ data: updated, message: '修改成功' })
})

// 删除用户
router.delete('/:id', superAdminOnly, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ message: '用户不存在' })
  if (user.role === 'superadmin') {
    return res.status(400).json({ message: '不能删除超级管理员' })
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id)
  res.json({ message: '删除成功' })
})
