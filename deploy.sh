#!/bin/bash
set -e

# ── CDK Delivery Core — One-click Deploy Script ─────
REPO_URL="${REPO_URL:-https://github.com/xiaoxin-zk/cdk-delivery-core.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/cdk-delivery-core}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
GIT_BIN="${GIT_BIN:-}"

echo "========================================"
echo "  CDK Delivery Core - 一键部署"
echo "========================================"

find_git() {
  if [ -n "$GIT_BIN" ]; then
    if [ -x "$GIT_BIN" ]; then
      echo "$GIT_BIN"
      return
    fi
    echo "✖ GIT_BIN 指向的文件不可执行: $GIT_BIN"
    exit 1
  fi

  if command -v git &>/dev/null; then
    command -v git
    return
  fi

  for candidate in /usr/bin/git /usr/local/bin/git /opt/git/bin/git; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return
    fi
  done

  echo "✖ 未找到 git。请安装 git，或执行前指定 GIT_BIN=/完整路径/git"
  exit 1
}

random_secret() {
  openssl rand -hex "$1"
}

prompt_password() {
  local password=""
  local confirm=""
  while true; do
    read -r -s -p "管理员密码（至少 12 位）: " password < /dev/tty
    echo ""
    read -r -s -p "再次输入管理员密码: " confirm < /dev/tty
    echo ""
    if [ "$password" != "$confirm" ]; then
      echo "✖ 两次密码不一致，请重新输入。"
      continue
    fi
    if [ "${#password}" -lt 12 ]; then
      echo "✖ 管理员密码至少 12 位。"
      continue
    fi
    printf "%s" "$password"
    return
  done
}

GIT="$(find_git)"

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
  "$GIT" pull --ff-only
else
  echo "▶ 克隆项目..."
  "$GIT" clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ── 3. Generate .env if missing ──────────────────────
if [ ! -f .env ]; then
  echo "▶ 生成 .env 配置文件..."
  echo "▶ 请设置首个管理员账号。"
  if [ ! -r /dev/tty ]; then
    echo "✖ 当前环境不支持交互输入。请在终端执行，或设置 ADMIN_EMAIL 和 ADMIN_PASSWORD 后再运行。"
    exit 1
  fi
  DEFAULT_ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
  read -r -p "管理员邮箱 [${DEFAULT_ADMIN_EMAIL}]: " ADMIN_EMAIL_INPUT < /dev/tty
  ADMIN_EMAIL_VALUE="$(printf "%s" "${ADMIN_EMAIL_INPUT:-$DEFAULT_ADMIN_EMAIL}" | xargs)"
  ADMIN_PASSWORD_VALUE="${ADMIN_PASSWORD:-}"
  if [ -z "$ADMIN_PASSWORD_VALUE" ]; then
    ADMIN_PASSWORD_VALUE="$(prompt_password)"
  elif [ "${#ADMIN_PASSWORD_VALUE}" -lt 12 ]; then
    echo "✖ 环境变量 ADMIN_PASSWORD 至少需要 12 位。"
    exit 1
  fi

  PG_PASS=$(random_secret 24)
  JWT=$(random_secret 32)
  APP=$(random_secret 32)

  cat > .env <<EOF
APP_PORT=3000
APP_URL=${APP_URL:-http://$(hostname -I | awk '{print $1}'):3000}

POSTGRES_DB=cdk_delivery_core
POSTGRES_USER=cdk
POSTGRES_PASSWORD=${PG_PASS}
DATABASE_URL=postgresql://cdk:${PG_PASS}@postgres:5432/cdk_delivery_core?schema=public&connection_limit=3
REDIS_URL=

JWT_SECRET=${JWT}
APP_SECRET=${APP}

ADMIN_EMAIL=${ADMIN_EMAIL_VALUE}
ADMIN_PASSWORD=${ADMIN_PASSWORD_VALUE}

SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_NAME=CDK Delivery Core
SMTP_FROM_EMAIL=
SMTP_SECURE=false

TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
EOF
  echo "✔ .env 已生成（密钥已随机生成）"
  echo ""
  echo "  管理员账号: ${ADMIN_EMAIL_VALUE}"
  echo ""
  echo "  ⚠ 请妥善保存管理员密码。"
  echo ""
fi

# ── 4. Pull and start ────────────────────────────────
echo "▶ 拉取最新镜像..."
docker compose -f "$COMPOSE_FILE" pull

echo "▶ 启动服务..."
docker compose -f "$COMPOSE_FILE" up -d

APP_URL_FROM_ENV=$(grep -E '^APP_URL=' .env | cut -d= -f2-)

echo ""
echo "========================================"
echo "  ✔ 部署完成！"
echo "  访问: ${APP_URL_FROM_ENV:-http://$(hostname -I | awk '{print $1}'):3000}"
echo "  日志: docker compose -f $COMPOSE_FILE logs -f app"
echo "========================================"
