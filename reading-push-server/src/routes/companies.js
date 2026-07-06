import { Router } from 'express'
import pool from '../db/mysql.js'
import { authMiddleware, superAdminOnly } from '../middleware/auth.js'

export const router = Router()

// 所有公司路由需要登录
router.use(authMiddleware)

// 获取公司列表
router.get('/', async (req, res, next) => {
  try {
    const [companies] = await pool.execute('SELECT * FROM companies ORDER BY id ASC')
    res.json({ data: companies })
  } catch (err) {
    next(err)
  }
})

// 获取单个公司
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM companies WHERE id = ?', [req.params.id])
    const company = rows[0]
    if (!company) return res.status(404).json({ message: '公司不存在' })
    res.json({ data: company })
  } catch (err) {
    next(err)
  }
})

// 新增公司
router.post('/', superAdminOnly, async (req, res, next) => {
  try {
    const { name, contact, phone, webhook, status } = req.body
    if (!name || !webhook) {
      return res.status(400).json({ message: '公司名称和Webhook地址不能为空' })
    }

    const [result] = await pool.execute(
      'INSERT INTO companies (name, contact, phone, webhook, status) VALUES (?, ?, ?, ?, ?)',
      [name, contact || '', phone || '', webhook, status || 'active']
    )

    const [rows] = await pool.execute('SELECT * FROM companies WHERE id = ?', [result.insertId])
    const company = rows[0]
    res.status(201).json({ data: company, message: '新增成功' })
  } catch (err) {
    next(err)
  }
})

// 编辑公司
router.put('/:id', superAdminOnly, async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM companies WHERE id = ?', [req.params.id])
    const company = rows[0]
    if (!company) return res.status(404).json({ message: '公司不存在' })

    const { name, contact, phone, webhook, status } = req.body
    await pool.execute(
      'UPDATE companies SET name = ?, contact = ?, phone = ?, webhook = ?, status = ? WHERE id = ?',
      [name || company.name, contact ?? company.contact, phone ?? company.phone, webhook ?? company.webhook, status ?? company.status, req.params.id]
    )

    const [updatedRows] = await pool.execute('SELECT * FROM companies WHERE id = ?', [req.params.id])
    const updated = updatedRows[0]
    res.json({ data: updated, message: '修改成功' })
  } catch (err) {
    next(err)
  }
})

// 删除公司（同时删除该公司下所有推送任务）
router.delete('/:id', superAdminOnly, async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM companies WHERE id = ?', [req.params.id])
    const company = rows[0]
    if (!company) return res.status(404).json({ message: '公司不存在' })

    const [countResult] = await pool.execute('SELECT COUNT(*) as count FROM push_tasks WHERE company_id = ?', [req.params.id])
    const taskCount = countResult[0].count

    const conn = await pool.getConnection()
    await conn.beginTransaction()
    try {
      await conn.execute('DELETE FROM push_tasks WHERE company_id = ?', [req.params.id])
      await conn.execute('DELETE FROM companies WHERE id = ?', [req.params.id])
      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }

    res.json({ message: `删除成功，同时删除了 ${taskCount} 条推送任务` })
  } catch (err) {
    next(err)
  }
})
