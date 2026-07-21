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
      push_time TEXT DEFAULT '09:00',
      greeting TEXT DEFAULT '',
      weather_enabled INTEGER DEFAULT 0,
      weather_city TEXT DEFAULT '',
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
      push_title TEXT DEFAULT '【每日分享】',
      push_date TEXT NOT NULL,
      book_name TEXT NOT NULL,
      content TEXT NOT NULL,
      webhook TEXT DEFAULT '',
      exec_status TEXT DEFAULT 'pending',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    -- 用户-公司关联表（多对多）
    CREATE TABLE IF NOT EXISTS user_companies (
      user_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, company_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    -- 推送记录表
    CREATE TABLE IF NOT EXISTS push_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      company_name TEXT NOT NULL,
      push_date TEXT NOT NULL,
      push_time TEXT NOT NULL,
      book_name TEXT NOT NULL,
      status TEXT DEFAULT 'success',
      error_msg TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (task_id) REFERENCES push_tasks(id),
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_push_tasks_company ON push_tasks(company_id);
    CREATE INDEX IF NOT EXISTS idx_push_tasks_date ON push_tasks(push_date);
    CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
    CREATE INDEX IF NOT EXISTS idx_push_logs_task ON push_logs(task_id);
    CREATE INDEX IF NOT EXISTS idx_push_logs_company ON push_logs(company_id);
    CREATE INDEX IF NOT EXISTS idx_push_logs_date ON push_logs(push_date);
  `)

  // 为已有数据库补充新增字段（SQLite 不支持 IF NOT EXISTS for ALTER TABLE）
  try { db.exec(`ALTER TABLE companies ADD COLUMN greeting TEXT DEFAULT ''`) } catch (_) {}
  try { db.exec(`ALTER TABLE companies ADD COLUMN weather_enabled INTEGER DEFAULT 0`) } catch (_) {}
  try { db.exec(`ALTER TABLE companies ADD COLUMN weather_city TEXT DEFAULT ''`) } catch (_) {}
  try { db.exec(`ALTER TABLE push_tasks ADD COLUMN push_title TEXT DEFAULT '【每日分享】'`) } catch (_) {}
  // 为存量 push_tasks 回填 push_title
  try { db.exec(`UPDATE push_tasks SET push_title = '【每日分享】' WHERE push_title IS NULL OR push_title = ''`) } catch (_) {}
  // 迁移存量用户-公司关系到 user_companies 表
  try { db.exec(`INSERT OR IGNORE INTO user_companies (user_id, company_id) SELECT id, company_id FROM users WHERE company_id IS NOT NULL`) } catch (_) {}

  // 初始化默认数据
  const companyCount = db.prepare('SELECT COUNT(*) as count FROM companies').get().count
  if (companyCount === 0) {
    // 使用bcrypt对种子密码进行哈希
    const adminHash = bcrypt.hashSync('admin123', 10)
    const meiceHash = bcrypt.hashSync('meice123', 10)
    const xiaomingHash = bcrypt.hashSync('xiaoming123', 10)

    db.exec(`
      INSERT INTO companies (name, contact, phone, webhook, push_time, status) VALUES
        ('美策广告', '张经理', '13800138001', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', '09:00', 'active'),
        ('小明科技', '李总', '13900139002', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', '10:00', 'active'),
        ('星辰教育', '王老师', '13700137003', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', '08:30', 'inactive');
    `)

    db.prepare("INSERT INTO users (username, password, name, role, company_id, company_name, status) VALUES (?, ?, '超级管理员', 'superadmin', NULL, '-', 'active')")
      .run('admin', adminHash)
    db.prepare("INSERT INTO users (username, password, name, role, company_id, company_name, status) VALUES (?, ?, '美策操作员', 'operator', 1, '美策广告', 'active')")
      .run('meice', meiceHash)
    db.prepare("INSERT INTO users (username, password, name, role, company_id, company_name, status) VALUES (?, ?, '小明操作员', 'operator', 2, '小明科技', 'active')")
      .run('xiaoming', xiaomingHash)

    db.exec(`
      INSERT INTO push_tasks (company_id, company_name, title, push_title, push_date, book_name, content, webhook, exec_status, status) VALUES
        (1, '美策广告', '今日读书分享', '【每日分享】', '2024-07-07', '《高效能人士的七个习惯》', '第一章 积极主动的内容...', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', 'pushed', 'active'),
        (1, '美策广告', '今日读书分享', '【每日分享】', '2024-07-08', '《高效能人士的七个习惯》', '第二章 以终为始的内容...', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', 'pending', 'active'),
        (1, '美策广告', '今日读书分享', '【每日分享】', '2024-07-09', '《高效能人士的七个习惯》', '第三章 第一节 要事第一...', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', 'pending', 'active'),
        (2, '小明科技', '晨读分享', '【每日分享】', '2024-07-10', '《深度工作》', '第一章 深度工作是有价值的...', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', 'pending', 'active'),
        (2, '小明科技', '晨读分享', '【每日分享】', '2024-07-11', '《深度工作》', '第二章 深度工作是少见的...', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', 'pending', 'inactive');
    `)

    // 迁移存量用户-公司关系到 user_companies 表
    db.exec(`INSERT OR IGNORE INTO user_companies (user_id, company_id) SELECT id, company_id FROM users WHERE company_id IS NOT NULL`)

    console.log('  ✓ 数据库初始化完成，已插入默认数据')
  } else {
    console.log('  ✓ 数据库已存在，跳过初始化')
  }
}

export default db
