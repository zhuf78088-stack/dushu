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
      [rows] = await pool.execute(
        `SELECT u.id, u.username, u.name, u.role, u.status, u.created_at,
                GROUP_CONCAT(uc.company_id) as company_ids
         FROM users u
         LEFT JOIN user_companies uc ON u.id = uc.user_id
         GROUP BY u.id
         ORDER BY u.id ASC`
      )
    } else {
      // 操作员只能看到与自己同公司的用户
      const companyIds = req.user.companyIds || [req.user.companyId]
      if (companyIds.length === 0) {
        rows = []
      } else {
        const placeholders = companyIds.map(() => '?').join(',')
        [rows] = await pool.execute(
          `SELECT u.id, u.username, u.name, u.role, u.status, u.created_at,
                  GROUP_CONCAT(uc.company_id) as company_ids
           FROM users u
           INNER JOIN user_companies uc ON u.id = uc.user_id
           WHERE uc.company_id IN (${placeholders})
           GROUP BY u.id
           ORDER BY u.id ASC`,
          companyIds
        )
      }
    }

    // 处理后端返回的 company_ids 字符串为数组
    const data = rows.map(row => ({
      ...row,
      company_ids: row.company_ids ? row.company_ids.split(',').map(Number) : []
    }))

    res.json({ data })
  } catch (err) {
    next(err)
  }
})

// 新增用户
router.post('/', superAdminOnly, async (req, res, next) => {
  const { username, password, name, role, companyIds, status } = req.body
  if (!username || !password || !name) {
    return res.status(400).json({ message: '用户名、密码和姓名不能为空' })
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10)
    const [result] = await pool.execute(
      'INSERT INTO users (username, password, name, role, company_id, company_name, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, name, role || 'operator', null, '-', status || 'active']
    )

    const userId = result.insertId

    // 插入用户-公司关联
    if (companyIds && Array.isArray(companyIds) && companyIds.length > 0) {
      const values = companyIds.map(cid => [userId, cid])
      await pool.query('INSERT INTO user_companies (user_id, company_id) VALUES ?', [values])
    }

    const [userRows] = await pool.execute(
      `SELECT id, username, name, role, status, created_at FROM users WHERE id = ?`,
      [userId]
    )
    const user = userRows[0]
    user.companyIds = companyIds || []
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

    const { username, password, name, role, companyIds, status } = req.body
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10)
      await pool.execute('UPDATE users SET password = ?, name = ?, role = ?, status = ? WHERE id = ?',
        [hashedPassword, name || user.name, role ?? user.role, status ?? user.status, req.params.id])
    } else {
      await pool.execute('UPDATE users SET name = ?, role = ?, status = ? WHERE id = ?',
        [name || user.name, role ?? user.role, status ?? user.status, req.params.id])
    }

    // 同步用户-公司关联
    if (companyIds !== undefined) {
      await pool.execute('DELETE FROM user_companies WHERE user_id = ?', [req.params.id])
      if (Array.isArray(companyIds) && companyIds.length > 0) {
        const values = companyIds.map(cid => [req.params.id, cid])
        await pool.query('INSERT INTO user_companies (user_id, company_id) VALUES ?', [values])
      }
    }

    const [updatedRows] = await pool.execute(
      `SELECT id, username, name, role, status, created_at FROM users WHERE id = ?`,
      [req.params.id]
    )
    const updated = updatedRows[0]
    // 重新加载公司关联
    const [companyRows] = await pool.execute('SELECT company_id FROM user_companies WHERE user_id = ?', [req.params.id])
    updated.companyIds = companyRows.map(r => r.company_id)
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

    await pool.execute('DELETE FROM user_companies WHERE user_id = ?', [req.params.id])
    await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id])
    res.json({ message: '删除成功' })
  } catch (err) {
    next(err)
  }
})
