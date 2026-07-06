import { Router } from 'express'
import bcrypt from 'bcryptjs'
import pool from '../db/mysql.js'
import { authMiddleware, superAdminOnly } from '../middleware/auth.js'

export const router = Router()

router.use(authMiddleware)

// 获取用户列表
router.get('/', async (req, res, next) => {
  try {
    let rows
    if (req.user.role === 'superadmin') {
      [rows] = await pool.execute('SELECT id, username, name, role, company_id, company_name, status, created_at FROM users ORDER BY id ASC')
    } else {
      // 操作员只能看到自己公司的用户
      [rows] = await pool.execute('SELECT id, username, name, role, company_id, company_name, status, created_at FROM users WHERE company_id = ? ORDER BY id ASC', [req.user.companyId])
    }
    res.json({ data: rows })
  } catch (err) {
    next(err)
  }
})

// 新增用户
router.post('/', superAdminOnly, async (req, res, next) => {
  const { username, password, name, role, companyId, companyName, status } = req.body
  if (!username || !password || !name) {
    return res.status(400).json({ message: '用户名、密码和姓名不能为空' })
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10)
    const [result] = await pool.execute(
      'INSERT INTO users (username, password, name, role, company_id, company_name, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, name, role || 'operator', companyId || null, companyName || '-', status || 'active']
    )

    const [userRows] = await pool.execute('SELECT id, username, name, role, company_id, company_name, status, created_at FROM users WHERE id = ?', [result.insertId])
    const user = userRows[0]
    res.status(201).json({ data: user, message: '新增成功' })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: '用户名已存在' })
    }
    next(err)
  }
})

// 编辑用户
router.put('/:id', superAdminOnly, async (req, res, next) => {
  try {
    const [userRows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.params.id])
    const user = userRows[0]
    if (!user) return res.status(404).json({ message: '用户不存在' })

    const { username, password, name, role, companyId, companyName, status } = req.body
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10)
      await pool.execute('UPDATE users SET password = ?, name = ?, role = ?, company_id = ?, company_name = ?, status = ? WHERE id = ?',
        [hashedPassword, name || user.name, role ?? user.role, companyId ?? user.company_id, companyName ?? user.company_name, status ?? user.status, req.params.id])
    } else {
      await pool.execute('UPDATE users SET name = ?, role = ?, company_id = ?, company_name = ?, status = ? WHERE id = ?',
        [name || user.name, role ?? user.role, companyId ?? user.company_id, companyName ?? user.company_name, status ?? user.status, req.params.id])
    }

    const [updatedRows] = await pool.execute('SELECT id, username, name, role, company_id, company_name, status, created_at FROM users WHERE id = ?', [req.params.id])
    const updated = updatedRows[0]
    res.json({ data: updated, message: '修改成功' })
  } catch (err) {
    next(err)
  }
})

// 删除用户
router.delete('/:id', superAdminOnly, async (req, res, next) => {
  try {
    const [userRows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.params.id])
    const user = userRows[0]
    if (!user) return res.status(404).json({ message: '用户不存在' })
    if (user.role === 'superadmin') {
      return res.status(400).json({ message: '不能删除超级管理员' })
    }

    await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id])
    res.json({ message: '删除成功' })
  } catch (err) {
    next(err)
  }
})
