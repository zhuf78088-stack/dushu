# 读书推送系统 - 生产部署指南

## 整体架构

| 服务 | 端口 | 说明 |
|------|------|------|
| Nginx | 80/443 | 反向代理 + 静态文件服务 |
| 前端 | 托管给 Nginx | 打包后的 dist 文件 |
| 后端 | 3000 (内部) | Node.js + Express + SQLite |

## 腾讯云服务器准备

### 1. 购买轻量应用服务器（推荐）
- 系统：Ubuntu 22.04 LTS
- 配置：2核 2G 以上
- 防火墙：开放 80、443、3000（可选，内网访问可不开）

### 2. 服务器初始化

```bash
# SSH 登录
ssh root@你的服务器IP

# 更新系统
apt update && apt upgrade -y

# 安装 Node.js 20
apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 安装 Nginx
apt install -y nginx

# 安装 PM2（Node.js 进程守护）
npm install -g pm2

# 安装 Git
apt install -y git
```

## 代码上传到 GitHub

### 方式一：现有代码直接推送（推荐）

在项目根目录执行：

```bash
cd reading-push-admin
npm run build

# 回到项目根目录
cd ..

# 初始化 git
git init
git add .
git commit -m "init: 读书推送系统"

# 推送到 GitHub（先创建空仓库）
git remote add origin https://github.com/你的用户名/reading-push-system.git
git push -u origin main
```

### 方式二：直接在服务器 git clone

```bash
git clone https://github.com/你的用户名/reading-push-system.git
cd reading-push-system
```

## 后端部署

```bash
cd reading-push-server

# 安装依赖
npm install --production

# 创建日志目录
mkdir -p logs data

# 用 PM2 启动
pm2 start ecosystem.config.cjs

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status
pm2 logs reading-push-server
```

## 前端部署

```bash
cd reading-push-admin

# 安装依赖
npm install

# 生产打包（生成 dist 目录）
npm run build

# 将 dist 复制到 Nginx 目录
cp -r dist /var/www/reading-push
```

## Nginx 配置

创建配置文件：

```bash
nano /etc/nginx/sites-available/reading-push
```

写入以下内容：

```nginx
server {
    listen 80;
    server_name 你的域名;  # 如 reading.yourdomain.com

    # 前端静态文件
    location / {
        root /var/www/reading-push;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API 代理到后端
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

启用配置：

```bash
ln -s /etc/nginx/sites-available/reading-push /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

## 配置 HTTPS（SSL 证书）

```bash
apt install -y certbot python3-certbot-nginx

# 自动获取证书并配置 Nginx
certbot --nginx -d 你的域名

# 自动续期已内置，无需额外配置
```

## 安全加固（建议）

### 1. 更换 JWT 密钥

```bash
nano reading-push-server/src/middleware/auth.js
```

将 `JWT_SECRET` 改为一个随机长字符串：

```js
const JWT_SECRET = 'your-random-secret-key-xxx...'  // 生产环境务必更换！
```

### 2. 修改默认演示密码

首次部署后，在数据库中修改默认密码：

```bash
cd reading-push-server/src/data
sqlite3 reading-push.db

-- 修改 admin 密码
UPDATE users SET password = '你的新密码' WHERE username = 'admin';
.quit
```

### 3. 数据库备份

```bash
# 创建定时备份脚本
crontab -e

# 每天凌晨 3 点备份数据库
0 3 * * * cp /root/reading-push-system/reading-push-server/src/data/reading-push.db /root/backups/reading-push-$(date +\%Y\%m\%d).db
```

## 更新部署

代码更新后：

```bash
cd reading-push-system
git pull

# 更新后端
cd reading-push-server
pm install --production
pm2 restart reading-push-server

# 更新前端
cd ../reading-push-admin
npm install
npm run build
cp -r dist /var/www/reading-push
```

## 查看日志

```bash
# 后端实时日志
pm2 logs reading-push-server

# Nginx 错误日志
tail -f /var/log/nginx/error.log

# Nginx 访问日志
tail -f /var/log/nginx/access.log
```

## 常见问题

### 1. 前端刷新 404
确保 Nginx 配置中有 `try_files $uri $uri/ /index.html;`

### 2. 跨域问题
确保 Nginx 代理配置中 `proxy_pass` 末尾有 `/`，且前端使用相对路径 `/api`

### 3. 数据库权限
确保 `reading-push-server/src/data/` 目录有写入权限：
```bash
chmod -R 755 reading-push-server/src/data/
```
