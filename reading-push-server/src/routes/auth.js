import { Router } from 'express'
import db from '../db/init.js'
import { generateToken } from '../middleware/auth.js'

export const router = Router()

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码不能为空' })
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ? AND status = 'active'").get(username)
  if (!user || user.password !== password) {
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
router.get('/me', (req, res) => {
  // 这个路由由authMiddleware保护
  res.json({ user: req.user })
})
