#!/bin/bash
set -e

echo "=========================================="
echo "  读书推送系统 - 自动部署脚本"
echo "  域名: chzf.online"
echo "=========================================="

# 自动检测包管理器
if command -v apt-get &> /dev/null; then
  PKG_MANAGER="apt"
  PKG_INSTALL="apt-get install -y -qq"
  PKG_UPDATE="apt-get update -qq && apt-get upgrade -y -qq"
  export DEBIAN_FRONTEND=noninteractive
elif command -v dnf &> /dev/null; then
  PKG_MANAGER="dnf"
  PKG_INSTALL="dnf install -y"
  PKG_UPDATE="dnf update -y"
elif command -v yum &> /dev/null; then
  PKG_MANAGER="yum"
  PKG_INSTALL="yum install -y"
  PKG_UPDATE="yum update -y"
else
  echo "无法识别的包管理器，请手动安装依赖"
  exit 1
fi
echo "  检测到系统包管理器: $PKG_MANAGER"

# 1. 更新系统
echo ""
echo "[1/8] 更新系统包..."
eval $PKG_UPDATE > /dev/null 2>&1

# 2. 安装基础工具和编译依赖
echo ""
echo "[2/8] 安装基础工具和编译依赖..."
if [ "$PKG_MANAGER" = "apt" ]; then
  $PKG_INSTALL curl nginx git sqlite3 build-essential python3 > /dev/null 2>&1
else
  # CentOS/OpenCloudOS: 需要额外的 epel 和编译工具
  $PKG_INSTALL curl git sqlite3 gcc gcc-c++ make python3 > /dev/null 2>&1
  # 安装 nginx（如果不存在）
  if ! command -v nginx &> /dev/null; then
    $PKG_INSTALL nginx > /dev/null 2>&1
  fi
  # 启用并启动 nginx
  systemctl enable nginx > /dev/null 2>&1
  systemctl start nginx > /dev/null 2>&1
fi

# 3. 安装 Node.js 20
echo ""
echo "[3/8] 安装 Node.js 20..."
if ! command -v node &> /dev/null; then
  if [ "$PKG_MANAGER" = "apt" ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    $PKG_INSTALL nodejs > /dev/null 2>&1
  else
    # RHEL/CentOS/OpenCloudOS
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    $PKG_INSTALL nodejs > /dev/null 2>&1
  fi
fi
echo "  Node.js: $(node -v)"
echo "  npm: $(npm -v)"

# 4. 安装 PM2
echo ""
echo "[4/8] 安装 PM2..."
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2 > /dev/null 2>&1
fi
echo "  PM2 已安装"

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
npm install 2>&1 | tail -5
mkdir -p logs

# 停止旧进程
pm2 stop reading-push-server 2>/dev/null || true
pm2 delete reading-push-server 2>/dev/null || true

# 启动后端
pm2 start ecosystem.config.cjs
sleep 3

# 检查后端是否启动成功
if pm2 pid reading-push-server > /dev/null 2>&1; then
  echo "  后端服务启动成功 (PID: $(pm2 pid reading-push-server))"
else
  echo "  后端启动失败，查看日志："
  pm2 logs reading-push-server --lines 15 --nostream
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
npm run build 2>&1 | tail -5

if [ -d "dist" ]; then
  rm -rf /var/www/reading-push
  cp -r dist /var/www/reading-push
  echo "  前端打包完成"
else
  echo "  前端打包失败！"
  exit 1
fi

# 8. 配置 Nginx
echo ""
echo "[8/8] 配置 Nginx..."
NGINX_CONF_DIR="/etc/nginx"
# 检查 nginx 配置目录结构（Debian vs RHEL）
if [ -d "/etc/nginx/sites-available" ]; then
  NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
  NGINX_CONF_DIR="/etc/nginx/sites-available"
else
  NGINX_ENABLED_DIR="/etc/nginx/conf.d"
  NGINX_CONF_DIR="/etc/nginx/conf.d"
fi

# 域名配置
cat > ${NGINX_CONF_DIR}/reading-push.conf << 'NGINX_CONF'
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
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_CONF

# IP 直接访问（备用）
cat > ${NGINX_CONF_DIR}/reading-push-ip.conf << 'NGINX_CONF'
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
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_CONF

# 删除默认配置
rm -f ${NGINX_ENABLED_DIR}/default 2>/dev/null || true

nginx -t && systemctl reload nginx
echo "  Nginx 配置完成"

# 验证
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
