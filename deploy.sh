#!/bin/bash
set -e

# ── CDK Delivery Core — One-click Deploy Script ─────
REPO_URL="https://github.com/xiaoxin-zk/cdk-delivery-core.git"
INSTALL_DIR="/opt/cdk-delivery-core"
COMPOSE_FILE="docker-compose.prod.yml"

echo "========================================"
echo "  CDK Delivery Core - 一键部署"
echo "========================================"

# ── 1. Check Docker ──────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "▶ Docker 未安装，正在安装..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
  echo "✔ Docker 安装完成"
fi

if ! docker compose version &>/dev/null; then
  echo "✖ docker compose 不可用，请升级 Docker 到最新版本"
  exit 1
fi

# ── 2. Clone or update repo ──────────────────────────
if [ -d "$INSTALL_DIR" ]; then
  echo "▶ 更新项目代码..."
  cd "$INSTALL_DIR"
  git pull --ff-only
else
  echo "▶ 克隆项目..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ── 3. Generate .env if missing ──────────────────────
if [ ! -f .env ]; then
  echo "▶ 生成 .env 配置文件..."
  PG_PASS=$(openssl rand -base64 24)
  JWT=$(openssl rand -base64 32)
  APP=$(openssl rand -base64 32)
  ADMIN_PASS=$(openssl rand -base64 18)

  cat > .env <<EOF
APP_PORT=3000
APP_URL=http://localhost:3000

POSTGRES_DB=cdk_delivery_core
POSTGRES_USER=cdk
POSTGRES_PASSWORD=${PG_PASS}
DATABASE_URL=postgresql://cdk:${PG_PASS}@postgres:5432/cdk_delivery_core?schema=public&connection_limit=3
REDIS_URL=

JWT_SECRET=${JWT}
APP_SECRET=${APP}

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=${ADMIN_PASS}

SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_NAME=CDK Delivery Core
SMTP_FROM_EMAIL=no-reply@example.com
SMTP_SECURE=false

TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
EOF
  echo "✔ .env 已生成（密钥已随机生成）"
  echo ""
  echo "  管理员账号: admin@example.com"
  echo "  管理员密码: ${ADMIN_PASS}"
  echo ""
  echo "  ⚠ 请记住以上密码，或稍后修改 .env 中的 ADMIN_PASSWORD"
  echo ""
fi

# ── 4. Pull and start ────────────────────────────────
echo "▶ 拉取最新镜像..."
docker compose -f "$COMPOSE_FILE" pull

echo "▶ 启动服务..."
docker compose -f "$COMPOSE_FILE" up -d

echo ""
echo "========================================"
echo "  ✔ 部署完成！"
echo "  访问: http://$(hostname -I | awk '{print $1}'):3000"
echo "  日志: docker compose -f $COMPOSE_FILE logs -f app"
echo "========================================"
