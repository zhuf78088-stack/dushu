import { Router } from 'express'
import bcrypt from 'bcryptjs'
import pool from '../db/mysql.js'
import { generateToken, authMiddleware } from '../middleware/auth.js'

export const router = Router()

// 登录
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ message: '用户名和密码不能为空' })
    }

    const [rows] = await pool.execute("SELECT * FROM users WHERE username = ? AND status = 'active'", [username])
    const user = rows[0]
    if (!user) {
      return res.status(401).json({ message: '用户名或密码错误' })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return res.status(401).json({ message: '用户名或密码错误' })
    }

    const token = generateToken(user)
    const { password: _, ...userInfo } = user

    res.json({
      token,
      user: userInfo
    })
  } catch (err) {
    next(err)
  }
})

// 获取当前用户信息
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    res.json({ user: req.user })
  } catch (err) {
    next(err)
  }
})
