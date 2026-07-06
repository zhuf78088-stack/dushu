import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_DIR = path.join(__dirname, '..', 'data')

// 确保data目录存在
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

const DB_PATH = path.join(DB_DIR, 'reading-push.db')
const db = new Database(DB_PATH)

// 启用WAL模式提高性能
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export function initDB() {
  db.exec(`
    -- 公司表
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      webhook TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- 用户表
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'operator',
      company_id INTEGER,
      company_name TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- 推送任务表
    CREATE TABLE IF NOT EXISTS push_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      company_name TEXT NOT NULL,
      title TEXT DEFAULT '',
      push_date TEXT NOT NULL,
      push_time TEXT NOT NULL,
      book_name TEXT NOT NULL,
      content TEXT NOT NULL,
      webhook TEXT DEFAULT '',
      exec_status TEXT DEFAULT 'pending',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_push_tasks_company ON push_tasks(company_id);
    CREATE INDEX IF NOT EXISTS idx_push_tasks_date ON push_tasks(push_date);
    CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
  `)

  // 初始化默认数据
  const companyCount = db.prepare('SELECT COUNT(*) as count FROM companies').get().count
  if (companyCount === 0) {
    // 使用bcrypt对种子密码进行哈希
    const adminHash = bcrypt.hashSync('admin123', 10)
    const meiceHash = bcrypt.hashSync('meice123', 10)
    const xiaomingHash = bcrypt.hashSync('xiaoming123', 10)

    db.exec(`
      INSERT INTO companies (name, contact, phone, webhook, status) VALUES
        ('美策广告', '张经理', '13800138001', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', 'active'),
        ('小明科技', '李总', '13900139002', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', 'active'),
        ('星辰教育', '王老师', '13700137003', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', 'inactive');
    `)

    db.prepare("INSERT INTO users (username, password, name, role, company_id, company_name, status) VALUES (?, ?, '超级管理员', 'superadmin', NULL, '-', 'active')")
      .run('admin', adminHash)
    db.prepare("INSERT INTO users (username, password, name, role, company_id, company_name, status) VALUES (?, ?, '美策操作员', 'operator', 1, '美策广告', 'active')")
      .run('meice', meiceHash)
    db.prepare("INSERT INTO users (username, password, name, role, company_id, company_name, status) VALUES (?, ?, '小明操作员', 'operator', 2, '小明科技', 'active')")
      .run('xiaoming', xiaomingHash)

    db.exec(`
      INSERT INTO push_tasks (company_id, company_name, title, push_date, push_time, book_name, content, webhook, exec_status, status) VALUES
        (1, '美策广告', '今日读书分享', '2024-07-07', '00:00', '《高效能人士的七个习惯》', '第一章 积极主动的内容...', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', 'pushed', 'active'),
        (1, '美策广告', '今日读书分享', '2024-07-08', '00:00', '《高效能人士的七个习惯》', '第二章 以终为始的内容...', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', 'pending', 'active'),
        (1, '美策广告', '今日读书分享', '2024-07-09', '00:00', '《高效能人士的七个习惯》', '第三章 第一节 要事第一...', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', 'pending', 'active'),
        (2, '小明科技', '晨读分享', '2024-07-10', '09:00', '《深度工作》', '第一章 深度工作是有价值的...', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', 'pending', 'active'),
        (2, '小明科技', '晨读分享', '2024-07-11', '09:00', '《深度工作》', '第二章 深度工作是少见的...', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', 'pending', 'inactive');
    `)
    console.log('  ✓ 数据库初始化完成，已插入默认数据')
  } else {
    console.log('  ✓ 数据库已存在，跳过初始化')
  }
}

export default db
