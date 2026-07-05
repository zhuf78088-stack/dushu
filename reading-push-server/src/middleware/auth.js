import jwt from 'jsonwebtoken'

const JWT_SECRET = 'reading-push-system-secret-key-2024'
const JWT_EXPIRES_IN = '7d'

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role, companyId: user.company_id, companyName: user.company_name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

// Express 中间件：验证JWT
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: '未登录或token已过期' })
  }

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded) {
    return res.status(401).json({ message: 'token无效或已过期' })
  }

  req.user = decoded
  next()
}

// 可选中间件：要求超管权限
export function superAdminOnly(req, res, next) {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ message: '需要超级管理员权限' })
  }
  next()
}
