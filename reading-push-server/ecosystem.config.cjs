module.exports = {
  apps: [{
    name: 'reading-push-server',
    script: './src/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DB_HOST: 'localhost',
      DB_PORT: 3306,
      DB_USER: 'reading_push',
      DB_PASSWORD: 'reading_push_2024',
      DB_NAME: 'reading_push',
      JWT_SECRET: 'change-this-to-a-random-string-in-production',
      CORS_ORIGINS: 'http://localhost:5173,https://chzf.online,http://chzf.online'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    merge_logs: true,
    max_memory_restart: '512M',
    restart_delay: 3000
  }]
}
