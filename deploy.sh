#!/bin/bash
set -e

echo "=========================================="
echo "  读书推送系统 - 快速部署脚本"
echo "  域名: chzf.online"
echo "=========================================="

# 自动检测包管理器
if command -v dnf &> /dev/null; then
  PKG_MANAGER="dnf"
  PKG_INSTALL="dnf install -y"
elif command -v yum &> /dev/null; then
  PKG_MANAGER="yum"
  PKG_INSTALL="yum install -y"
elif command -v apt-get &> /dev/null; then
  PKG_MANAGER="apt"
  PKG_INSTALL="apt-get install -y -qq"
else
  echo "无法识别的包管理器"
  exit 1
fi
echo "  包管理器: $PKG_MANAGER"

# 1. 安装编译工具和基础依赖
echo ""
echo "[1/6] 安装编译工具和基础依赖..."
$PKG_INSTALL curl git sqlite3 gcc gcc-c++ make python3 > /dev/null 2>&1
if ! command -v nginx &> /dev/null; then
  $PKG_INSTALL nginx > /dev/null 2>&1
fi
systemctl enable nginx > /dev/null 2>&1
systemctl start nginx > /dev/null 2>&1

# 2. 安装 Node.js 20
echo ""
echo "[2/6] 安装 Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
  $PKG_INSTALL nodejs > /dev/null 2>&1
fi
echo "  Node.js: $(node -v)"

# 3. 安装 PM2
echo ""
echo "[3/6] 安装 PM2..."
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2 > /dev/null 2>&1
fi
echo "  PM2 已安装"

# 4. 部署后端
echo ""
echo "[4/6] 部署后端..."
if [ -d "/root/reading-push-system" ]; then
  cd /root/reading-push-system && git pull
else
  git clone https://github.com/zhuf78088-stack/dushu.git /root/reading-push-system
  cd /root/reading-push-system
fi
cd reading-push-server
npm install 2>&1 | tail -3
mkdir -p logs
pm2 stop reading-push-server 2>/dev/null || true
pm2 delete reading-push-server 2>/dev/null || true
pm2 start ecosystem.config.cjs
sleep 3
if pm2 pid reading-push-server > /dev/null 2>&1; then
  echo "  后端启动成功"
else
  echo "  后端启动失败："
  pm2 logs reading-push-server --lines 15 --nostream
  exit 1
fi
pm2 startup > /dev/null 2>&1
pm2 save > /dev/null 2>&1

# 5. 部署前端
echo ""
echo "[5/6] 部署前端..."
cd /root/reading-push-system/reading-push-admin
npm install 2>&1 | tail -3
npm run build 2>&1 | tail -3
rm -rf /var/www/reading-push
cp -r dist /var/www/reading-push
echo "  前端完成"

# 6. 配置 Nginx
echo ""
echo "[6/6] 配置 Nginx..."
NGINX_DIR="/etc/nginx/conf.d"
if [ -d "/etc/nginx/sites-available" ]; then
  NGINX_DIR="/etc/nginx/sites-available"
fi
cat > ${NGINX_DIR}/reading-push.conf << 'EOF'
server {
    listen 80;
    server_name chzf.online www.chzf.online;
    location / {
        root /var/www/reading-push;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF
cat > ${NGINX_DIR}/reading-push-ip.conf << 'EOF'
server {
    listen 80 default_server;
    server_name _;
    location / {
        root /var/www/reading-push;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF
rm -f /etc/nginx/conf.d/default 2>/dev/null || true
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && systemctl reload nginx

echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo "  http://chzf.online"
echo "  http://122.51.94.118"
echo "  账号: admin / admin123"
echo "=========================================="
