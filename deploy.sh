#!/bin/bash
set -e

echo "=========================================="
echo "  读书推送系统 - 自动部署脚本"
echo "  域名: chzf.online"
echo "=========================================="

# 1. 更新系统
echo ""
echo "[1/8] 更新系统包..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

# 2. 安装基础工具和编译依赖
echo ""
echo "[2/8] 安装基础工具和编译依赖..."
# build-essential 和 python3 是 better-sqlite3 编译所需的
apt-get install -y -qq curl nginx git sqlite3 build-essential python3 > /dev/null 2>&1

# 3. 安装 Node.js 20
echo ""
echo "[3/8] 安装 Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs
fi
echo "  Node.js: $(node -v)"
echo "  npm: $(npm -v)"

# 4. 安装 PM2
echo ""
echo "[4/8] 安装 PM2..."
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2 > /dev/null 2>&1
fi
echo "  PM2: $(pm2 -v 2>/dev/null | head -1)"

# 5. 克隆代码
echo ""
echo "[5/8] 克隆代码..."
if [ -d "/root/reading-push-system" ]; then
  echo "  目录已存在，拉取最新代码..."
  cd /root/reading-push-system
  git pull
else
  git clone https://github.com/zhuf78088-stack/dushu.git /root/reading-push-system
  cd /root/reading-push-system
fi

# 6. 部署后端
echo ""
echo "[6/8] 部署后端..."
cd /root/reading-push-system/reading-push-server
npm install 2>&1 | tail -3
mkdir -p logs

# 停止旧进程
pm2 stop reading-push-server 2>/dev/null || true
pm2 delete reading-push-server 2>/dev/null || true

# 启动后端
pm2 start ecosystem.config.cjs
sleep 2

# 检查后端是否启动成功
if pm2 pid reading-push-server > /dev/null 2>&1; then
  echo "  后端服务启动成功 (PID: $(pm2 pid reading-push-server))"
else
  echo "  后端启动失败，查看日志："
  pm2 logs reading-push-server --lines 10 --nostream
  exit 1
fi

# 设置开机自启
pm2 startup > /dev/null 2>&1
pm2 save > /dev/null 2>&1

# 7. 部署前端
echo ""
echo "[7/8] 部署前端..."
cd /root/reading-push-system/reading-push-admin
npm install 2>&1 | tail -3
npm run build 2>&1 | tail -3

if [ -d "dist" ]; then
  rm -rf /var/www/reading-push
  cp -r dist /var/www/reading-push
  echo "  前端打包完成"
else
  echo "  前端打包失败！"
  exit 1
fi

# 8. 配置 Nginx（带域名）
echo ""
echo "[8/8] 配置 Nginx..."
cat > /etc/nginx/sites-available/reading-push << 'NGINX_CONF'
server {
    listen 80;
    server_name chzf.online www.chzf.online;

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
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_CONF

# 同时配置 IP 直接访问（备用）
cat > /etc/nginx/sites-available/reading-push-ip << 'NGINX_CONF'
server {
    listen 80 default_server;
    server_name _;

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
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_CONF

# 启用配置
ln -sf /etc/nginx/sites-available/reading-push /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/reading-push-ip /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx
echo "  Nginx 配置完成"

# 验证后端 API
echo ""
echo "=========================================="
echo "  验证服务..."
echo "=========================================="
sleep 1
API_TEST=$(curl -s http://127.0.0.1:3000/api/health 2>/dev/null || echo "FAIL")
if echo "$API_TEST" | grep -q '"status":"ok"'; then
  echo "  后端 API: 正常"
else
  echo "  后端 API: 异常 - $API_TEST"
fi

echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo ""
echo "  域名访问: http://chzf.online"
echo "  IP访问:   http://122.51.94.118"
echo "  默认账号: admin / admin123"
echo ""
echo "  常用命令:"
echo "    pm2 status                        查看后端状态"
echo "    pm2 logs reading-push-server      查看后端日志"
echo "    pm2 restart reading-push-server   重启后端"
echo "    nginx -t && systemctl reload nginx  重载Nginx"
echo "=========================================="
