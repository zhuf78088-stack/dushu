import { Router } from 'express'
import bcrypt from 'bcryptjs'
import db from '../db/init.js'
import { generateToken, authMiddleware } from '../middleware/auth.js'

export const router = Router()

// 登录
router.post('/login', async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码不能为空' })
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ? AND status = 'active'").get(username)
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
})

// 获取当前用户信息
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user })
})
