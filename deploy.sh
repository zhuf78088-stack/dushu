#!/bin/bash
set -e

echo "=========================================="
echo "  读书推送系统 - 自动部署脚本"
echo "=========================================="

# 1. 更新系统
echo ""
echo "[1/7] 更新系统包..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

# 2. 安装基础工具
echo ""
echo "[2/7] 安装基础工具..."
apt-get install -y -qq curl nginx git sqlite3 > /dev/null 2>&1

# 3. 安装 Node.js 20
echo ""
echo "[3/7] 安装 Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs
fi
echo "  Node.js: $(node -v)"
echo "  npm: $(npm -v)"

# 4. 安装 PM2
echo ""
echo "[4/7] 安装 PM2..."
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2 > /dev/null 2>&1
fi
echo "  PM2: $(pm2 -v | head -1)"

# 5. 克隆代码
echo ""
echo "[5/7] 克隆代码..."
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
echo "[6/7] 部署后端..."
cd /root/reading-push-system/reading-push-server
npm install --production > /dev/null 2>&1
mkdir -p logs src/data

# 停止旧进程（如果存在）
pm2 stop reading-push-server 2>/dev/null || true
pm2 delete reading-push-server 2>/dev/null || true

# 启动后端
pm2 start ecosystem.config.cjs

# 设置开机自启
pm2 startup > /dev/null 2>&1
pm2 save > /dev/null 2>&1

echo "  后端服务已启动 (端口 3000)"

# 7. 部署前端
echo ""
echo "[7/7] 部署前端..."
cd /root/reading-push-system/reading-push-admin
npm install > /dev/null 2>&1
npm run build > /dev/null 2>&1
rm -rf /var/www/reading-push
cp -r dist /var/www/reading-push

# 配置 Nginx
cat > /etc/nginx/sites-available/reading-push << 'NGINX_CONF'
server {
    listen 80;
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
    }
}
NGINX_CONF

# 启用 Nginx 配置
ln -sf /etc/nginx/sites-available/reading-push /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx

echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo ""
echo "  访问地址: http://122.51.94.118"
echo "  默认账号: admin / admin123"
echo ""
echo "  后端状态: pm2 status"
echo "  后端日志: pm2 logs reading-push-server"
echo "=========================================="
