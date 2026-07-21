import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'reading_push',
  password: process.env.DB_PASSWORD || 'reading_push_2024',
  database: process.env.DB_NAME || 'reading_push',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
})

export async function initDB() {
  const conn = await pool.getConnection()
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS companies (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        contact VARCHAR(100) DEFAULT '',
        phone VARCHAR(50) DEFAULT '',
        webhook VARCHAR(500) NOT NULL,
        push_time VARCHAR(20) DEFAULT '09:00',
        greeting TEXT,
        weather_enabled TINYINT(1) DEFAULT 0,
        weather_city VARCHAR(100) DEFAULT '',
        status VARCHAR(20) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(20) DEFAULT 'operator',
        company_id INT DEFAULT NULL,
        company_name VARCHAR(255) DEFAULT '',
        status VARCHAR(20) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS push_tasks (
        id INT PRIMARY KEY AUTO_INCREMENT,
        company_id INT NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        title VARCHAR(255) DEFAULT '',
        push_title VARCHAR(100) DEFAULT '【每日分享】',
        push_date VARCHAR(20) NOT NULL,
        book_name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        webhook VARCHAR(500) DEFAULT '',
        exec_status VARCHAR(20) DEFAULT 'pending',
        status VARCHAR(20) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_push_tasks_company (company_id),
        INDEX idx_push_tasks_date (push_date),
        FOREIGN KEY (company_id) REFERENCES companies(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS user_companies (
        user_id INT NOT NULL,
        company_id INT NOT NULL,
        PRIMARY KEY (user_id, company_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS push_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        task_id INT NOT NULL,
        company_id INT NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        push_date VARCHAR(20) NOT NULL,
        push_time VARCHAR(20) NOT NULL,
        book_name VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'success',
        error_msg TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_push_logs_task (task_id),
        INDEX idx_push_logs_company (company_id),
        INDEX idx_push_logs_date (push_date),
        FOREIGN KEY (task_id) REFERENCES push_tasks(id),
        FOREIGN KEY (company_id) REFERENCES companies(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    // 种子数据
    const [rows] = await conn.execute('SELECT COUNT(*) as count FROM companies')
    if (rows[0].count === 0) {
      console.log('  📦 首次运行，插入种子数据...')

      const adminHash = bcrypt.hashSync('admin123', 10)
      const meiceHash = bcrypt.hashSync('meice123', 10)
      const xiaomingHash = bcrypt.hashSync('xiaoming123', 10)

      await conn.execute(`
        INSERT INTO companies (name, contact, phone, webhook, push_time, status) VALUES
          ('美策广告', '张经理', '13800138001', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', '09:00', 'active'),
          ('小明科技', '李总', '13900139002', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', '10:00', 'active'),
          ('星辰教育', '王老师', '13700137003', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', '08:30', 'inactive')
      `)

      await conn.execute(
        "INSERT INTO users (username, password, name, role, company_id, company_name, status) VALUES (?, ?, '超级管理员', 'superadmin', NULL, '-', 'active')",
        ['admin', adminHash]
      )
      await conn.execute(
        "INSERT INTO users (username, password, name, role, company_id, company_name, status) VALUES (?, ?, '美策操作员', 'operator', 1, '美策广告', 'active')",
        ['meice', meiceHash]
      )
      await conn.execute(
        "INSERT INTO users (username, password, name, role, company_id, company_name, status) VALUES (?, ?, '小明操作员', 'operator', 2, '小明科技', 'active')",
        ['xiaoming', xiaomingHash]
      )

      await conn.execute(`
        INSERT INTO push_tasks (company_id, company_name, title, push_title, push_date, book_name, content, webhook, exec_status, status) VALUES
          (1, '美策广告', '今日读书分享', '【每日分享】', '2024-07-07', '《高效能人士的七个习惯》', '第一章 积极主动的内容...', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', 'pushed', 'active'),
          (1, '美策广告', '今日读书分享', '【每日分享】', '2024-07-08', '《高效能人士的七个习惯》', '第二章 以终为始的内容...', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', 'pending', 'active'),
          (1, '美策广告', '今日读书分享', '【每日分享】', '2024-07-09', '《高效能人士的七个习惯》', '第三章 第一节 要事第一...', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', 'pending', 'active'),
          (2, '小明科技', '晨读分享', '【每日分享】', '2024-07-10', '《深度工作》', '第一章 深度工作是有价值的...', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', 'pending', 'active'),
          (2, '小明科技', '晨读分享', '【每日分享】', '2024-07-11', '《深度工作》', '第二章 深度工作是少见的...', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY_HERE', 'pending', 'inactive')
      `)

      // 迁移存量用户-公司关系到 user_companies 表
      await conn.execute(`
        INSERT INTO user_companies (user_id, company_id)
        SELECT id, company_id FROM users WHERE company_id IS NOT NULL
        ON DUPLICATE KEY UPDATE company_id = VALUES(company_id)
      `)

      console.log('  ✓ 数据库初始化完成，已插入默认数据')
    } else {
      console.log('  ✓ 数据库已存在，跳过初始化')
    }
  } finally {
    conn.release()
  }
}

export default pool
