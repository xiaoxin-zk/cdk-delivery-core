# CDK Delivery Core

[中文](#中文说明) | [English](#english)

CDK Delivery Core is a Next.js + Prisma + PostgreSQL application for lawful CDK, license key, gift code, and redemption code distribution.

> Use this platform only for authorized and legal distribution scenarios. Do not use it for phishing, malware, piracy, illegal trading, or other abusive activity.

## 中文说明

### 项目简介

CDK Delivery Core 是一个用于合法分发 CDK、授权码、礼品码、兑换码的 Web 系统。它支持项目发布、CDK 导入与随机发放、抽奖参与、领取记录、后台审核、用户管理、邮件配置、Cloudflare Turnstile 防护等功能。

适合以下场景：

- 软件授权码、游戏兑换码、活动礼包码发放
- 内测资格码、邀请资格码、一次性兑换码分发
- 需要限制领取次数、记录领取人、保留审计信息的 CDK 发放系统

### 核心功能

- 项目创建、编辑、审核、公开/私有状态管理
- CDK 批量导入、导出、禁用、领取状态管理
- 三种领取模式：
  - 抽奖模式：按中奖概率发放，未中奖也记录参与
  - 每人一次：同一用户只能成功领取一次
  - 可重复领取：可多次领取，可配置单用户上限
- 单用户领取限制 `perUserLimit`
- 登录用户按用户 ID 限制，匿名用户按邮箱或领取标识限制
- 领取成功后立即显示 CDK、复制按钮、领取时间和使用说明
- 后台管理：用户、项目、CDK、领取记录、审核、敏感词、系统设置
- SMTP 邮件配置，支持邮箱验证和找回密码开关
- Cloudflare Turnstile 人机验证配置
- Redis 限流，Redis 不可用时回退到内存限流
- Docker Compose 一键部署

### 技术栈

- Next.js App Router + React + TypeScript
- Prisma ORM + PostgreSQL
- Redis
- JWT HttpOnly Cookie 登录态
- SMTP / Nodemailer
- Cloudflare Turnstile
- Vitest
- Docker Compose

### 快速开始：Docker Compose

1. 克隆仓库并进入目录。

```bash
git clone https://github.com/xiaoxin-zk/cdk-delivery-core.git
cd cdk-delivery-core
```

2. 安装依赖并自动生成本地配置。

```bash
npm install
```

安装完成后会自动执行 `npm run setup`，生成本地 `.env`。如果 `.env` 已经存在，脚本不会覆盖。

也可以手动执行：

```bash
npm run setup
```

3. 启动完整服务。

```bash
docker compose up -d --build
```

4. 打开应用。

```text
http://localhost:3000
```

自动生成的 `.env` 会包含随机本地值：

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `APP_SECRET`
- `ADMIN_PASSWORD`

因此新用户不需要手写配置文件即可启动本地环境。

### Linux 服务器预构建镜像部署

如果使用 GitHub 预构建镜像，可以直接运行：

```bash
curl -fsSL https://raw.githubusercontent.com/xiaoxin-zk/cdk-delivery-core/main/deploy.sh | bash
```

首次安装时脚本会自动生成 `.env`、随机数据库密码、`JWT_SECRET` 和 `APP_SECRET`，并交互式要求输入管理员邮箱和管理员密码。已有 `.env` 时不会覆盖。

Git 不在默认路径时传入 `GIT_BIN`；使用自己的 GitHub 仓库时传入 `REPO_URL`：

```bash
GIT_BIN=/opt/git/bin/git REPO_URL=https://github.com/your-name/your-repo.git bash deploy.sh
```

如果需要指定公开访问地址，可以在运行脚本时传入 `APP_URL`，否则脚本会默认使用服务器内网检测到的 IP 和 `3000` 端口：

```bash
APP_URL=http://114.215.175.9:3000 bash deploy.sh
```

### 默认管理员

本地开发自动生成的 `.env` 默认包含：

```env
ADMIN_EMAIL=admin@example.com
```

`ADMIN_PASSWORD` 会随机生成，请在本机 `.env` 中查看。服务器部署脚本会改为交互式输入管理员邮箱和密码。首次登录后建议立刻在界面中确认账号安全。

### 本地开发

```bash
npm install
npm run setup
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

常用检查命令：

```bash
npm run typecheck
npm test
npm run build
```

### Docker 网络注意事项

在 Docker Compose 内部，数据库和 Redis 必须使用服务名作为主机名：

```env
DATABASE_URL=postgresql://cdk:<POSTGRES_PASSWORD>@postgres:5432/cdk_delivery_core?schema=public
REDIS_URL=redis://redis:6379
```

不要在容器内使用 `localhost:5432` 连接数据库，因为 `localhost` 指向的是 app 容器自己。

### 环境变量

| 变量 | 是否必需 | 说明 |
| --- | --- | --- |
| `APP_PORT` | 否 | Docker 映射到宿主机的端口，默认 `3000` |
| `APP_URL` | 是 | 站点公开访问地址，用于邮件链接和跳转 |
| `DATABASE_URL` | 是 | Prisma 使用的 PostgreSQL 连接字符串 |
| `REDIS_URL` | 否 | Redis 连接字符串，不可用时回退到内存限流 |
| `JWT_SECRET` | 是 | JWT 签名密钥，建议至少 32 位随机字符串 |
| `APP_SECRET` | 是 | 加密 SMTP 密码、Turnstile Secret 等敏感设置 |
| `ADMIN_EMAIL` | 否 | 首个管理员邮箱 |
| `ADMIN_PASSWORD` | 否 | 首个管理员密码，仅在设置 `ADMIN_EMAIL` 时使用 |
| `POSTGRES_DB` | Compose | PostgreSQL 数据库名 |
| `POSTGRES_USER` | Compose | PostgreSQL 用户名 |
| `POSTGRES_PASSWORD` | Compose | PostgreSQL 密码 |
| `SMTP_HOST` | 否 | SMTP 主机，也可在后台配置 |
| `SMTP_PORT` | 否 | SMTP 端口，默认 `587` |
| `SMTP_USERNAME` | 否 | SMTP 用户名 |
| `SMTP_PASSWORD` | 否 | SMTP 密码，保存到系统设置时会加密 |
| `SMTP_FROM_NAME` | 否 | 发件人名称 |
| `SMTP_FROM_EMAIL` | 否 | 发件人邮箱。留空时使用 `SMTP_USERNAME` |
| `SMTP_SECURE` | 否 | 是否使用隐式 TLS |
| `TURNSTILE_SITE_KEY` | 否 | Cloudflare Turnstile Site Key |
| `TURNSTILE_SECRET_KEY` | 否 | Cloudflare Turnstile Secret Key |

### 数据库迁移

Docker 生产启动会运行：

```bash
npm run bootstrap:prod
```

该脚本会执行：

1. 校验生产环境变量
2. `prisma migrate deploy`
3. 初始化系统设置
4. 可选创建首个管理员

它不会创建演示用户、演示项目、示例 CDK、测试领取或其它假数据。

已运行服务的手动迁移命令：

```bash
docker compose exec app npx prisma migrate deploy
```

### 备份与恢复

备份 PostgreSQL：

```bash
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > backup.dump
```

恢复到空数据库：

```bash
docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < backup.dump
```

注意：

- 恢复生产数据前建议停止 app 或开启维护模式
- 不要删除 `postgres_data` volume，除非你明确要清空所有数据
- 请安全备份 `.env`，因为 `APP_SECRET` 用于解密数据库中的敏感设置

### 升级流程

1. 备份 PostgreSQL 和 `.env`
2. 拉取新版本代码
3. 对照 `.env.example` 检查新增变量
4. 重建并启动：

```bash
docker compose up -d --build
```

5. 查看日志直到迁移和初始化完成：

```bash
docker compose logs -f app
```

### 常见问题

#### 应用启动后无法连接数据库

检查 `DATABASE_URL` 是否使用 `postgres` 作为主机名。Docker Compose 内不要使用 `localhost` 连接数据库。

#### 忘记管理员密码

如果邮箱找回密码已开启并配置 SMTP，可使用找回密码流程。否则可以临时设置新的 `ADMIN_EMAIL`/`ADMIN_PASSWORD` 并重新运行 bootstrap，或通过数据库手动处理。

#### 邮件无法发送

检查 SMTP 主机、端口、用户名、密码、发件邮箱和 `SMTP_SECURE`。这些配置既可以写在 `.env`，也可以在后台邮件设置中配置。发件邮箱留空时系统会使用 `SMTP_USERNAME`；多数邮箱服务商要求发件邮箱与 SMTP 账号一致或是已验证别名。

如果开启了邮箱验证，用户注册时需要先接收并输入邮箱验证码；验证码通过后才会创建正式账号。验证码邮件发送失败时不会创建用户。

#### Turnstile 显示未配置

如果开启了 Turnstile，需要同时配置 Site Key 和 Secret Key。也可以在后台临时关闭对应场景的人机验证。

#### `/favicon.ico` 404

仓库包含 `public/favicon.ico`。请确认使用的是最新代码并重新构建镜像。

### 安全说明

- 不要提交真实 `.env`
- 不要把真实数据库密码、JWT 密钥、SMTP 密码、Turnstile Secret 上传到仓库
- 公开部署前必须检查并替换自动生成的默认管理员邮箱和密码
- `APP_SECRET` 一旦用于加密系统设置，轮换前需要先规划迁移

## English

### Overview

CDK Delivery Core is a web application for lawful CDK, license key, gift code, and redemption code delivery. It provides project publishing, CDK import/export, random assignment, lottery participation, claim history, admin review, user management, email settings, and Cloudflare Turnstile protection.

Good fits:

- Software license keys, game redemption codes, campaign gift codes
- Invite codes, beta access codes, one-time redemption keys
- Distribution systems that need per-user limits, audit fields, and claim records

### Features

- Project creation, editing, review, visibility, and status management
- CDK import, export, disable, and claim status management
- Claim modes:
  - Lottery: apply winning probability first; lost attempts are still recorded
  - Once: one successful claim per user
  - Repeat: multiple claims, optionally limited by `perUserLimit`
- Per-user claim limit support
- Logged-in users are limited by user ID; anonymous users are limited by email or identifier
- Successful claims immediately display CDK code, copy button, claim time, and instructions
- Admin panels for users, projects, CDKs, claims, reviews, sensitive words, and settings
- SMTP email settings, email verification, and forgot password switches
- Cloudflare Turnstile support
- Redis-backed rate limiting with in-memory fallback
- Docker Compose deployment

### Tech Stack

- Next.js App Router + React + TypeScript
- Prisma ORM + PostgreSQL
- Redis
- JWT HttpOnly cookie authentication
- SMTP / Nodemailer
- Cloudflare Turnstile
- Vitest
- Docker Compose

### Quick Start With Docker Compose

1. Clone the repository.

```bash
git clone https://github.com/xiaoxin-zk/cdk-delivery-core.git
cd cdk-delivery-core
```

2. Install dependencies and generate local configuration.

```bash
npm install
```

`npm install` automatically runs `npm run setup` and creates `.env`. If `.env` already exists, it is kept unchanged.

You can also run setup manually:

```bash
npm run setup
```

3. Start the full stack.

```bash
docker compose up -d --build
```

4. Open the app.

```text
http://localhost:3000
```

The generated `.env` includes random local values for:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `APP_SECRET`
- `ADMIN_PASSWORD`

This lets new users start the app without hand-writing a configuration file.

### Linux Server Deployment With Prebuilt Image

If you use the GitHub prebuilt image, run:

```bash
curl -fsSL https://raw.githubusercontent.com/xiaoxin-zk/cdk-delivery-core/main/deploy.sh | bash
```

On first install, the script generates `.env`, random database password, `JWT_SECRET`, and `APP_SECRET`, then prompts for the admin email and password. Existing `.env` files are kept unchanged.

If Git is not in the default path, pass `GIT_BIN`. If you deploy from your own GitHub repository, pass `REPO_URL`:

```bash
GIT_BIN=/opt/git/bin/git REPO_URL=https://github.com/your-name/your-repo.git bash deploy.sh
```

To set the public URL without editing `.env`, pass `APP_URL` when running the script. Otherwise the script defaults to the detected server IP on port `3000`:

```bash
APP_URL=http://114.215.175.9:3000 bash deploy.sh
```

### Default Admin

The local development `.env` generator uses:

```env
ADMIN_EMAIL=admin@example.com
```

`ADMIN_PASSWORD` is randomly generated. Check your local `.env` for the value. The server deployment script prompts for the admin email and password interactively. After the first login, review the account security in the UI.

### Local Development

```bash
npm install
npm run setup
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm test
npm run build
```

### Docker Networking

Inside Docker Compose, use service names as hostnames:

```env
DATABASE_URL=postgresql://cdk:<POSTGRES_PASSWORD>@postgres:5432/cdk_delivery_core?schema=public
REDIS_URL=redis://redis:6379
```

Do not use `localhost:5432` inside the app container, because `localhost` points to the app container itself.

### Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `APP_PORT` | No | Host port mapped to container port 3000. Default: `3000`. |
| `APP_URL` | Yes | Public site URL used for email links and redirects. |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma. |
| `REDIS_URL` | No | Redis connection string. If empty/unavailable, rate limiting falls back to memory. |
| `JWT_SECRET` | Yes | JWT signing secret. Use a random value with at least 32 characters. |
| `APP_SECRET` | Yes | Encryption secret for sensitive settings such as SMTP password and Turnstile secret. |
| `ADMIN_EMAIL` | No | First admin email for bootstrap. |
| `ADMIN_PASSWORD` | No | First admin password. Required only when `ADMIN_EMAIL` is set. |
| `POSTGRES_DB` | Compose | PostgreSQL database name. |
| `POSTGRES_USER` | Compose | PostgreSQL username. |
| `POSTGRES_PASSWORD` | Compose | PostgreSQL password. |
| `SMTP_HOST` | No | SMTP server host. Can also be configured in the admin UI. |
| `SMTP_PORT` | No | SMTP server port. Default: `587`. |
| `SMTP_USERNAME` | No | SMTP username. |
| `SMTP_PASSWORD` | No | SMTP password. Stored encrypted when saved to system settings. |
| `SMTP_FROM_NAME` | No | Sender display name. |
| `SMTP_FROM_EMAIL` | No | Sender email address. If empty, `SMTP_USERNAME` is used. |
| `SMTP_SECURE` | No | `true` for implicit TLS, otherwise `false`. |
| `TURNSTILE_SITE_KEY` | No | Cloudflare Turnstile site key. |
| `TURNSTILE_SECRET_KEY` | No | Cloudflare Turnstile secret key. Stored encrypted when saved to system settings. |

### Database Migrations

Docker production startup runs:

```bash
npm run bootstrap:prod
```

The script performs:

1. production environment validation
2. `prisma migrate deploy`
3. system setting initialization
4. optional first-admin bootstrap

It does not create demo users, demo projects, sample CDKs, test claims, or fake records.

Manual migration for a running deployment:

```bash
docker compose exec app npx prisma migrate deploy
```

### Backup And Restore

Create a PostgreSQL backup:

```bash
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > backup.dump
```

Restore into an empty database:

```bash
docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < backup.dump
```

Notes:

- Stop the app or enable maintenance mode before restoring production data.
- Do not delete the `postgres_data` volume unless you intentionally want to remove all database data.
- Back up `.env` securely because `APP_SECRET` is required to decrypt sensitive settings saved in the database.

### Upgrade Procedure

1. Back up PostgreSQL and `.env`.
2. Pull the new application version.
3. Review `.env.example` for new variables.
4. Rebuild and start:

```bash
docker compose up -d --build
```

5. Watch logs until migrations and bootstrap complete:

```bash
docker compose logs -f app
```

### Troubleshooting

#### Database Connection Fails

Use `postgres` as the host in `DATABASE_URL` when running with Docker Compose. Do not use `localhost`.

#### Forgot Admin Password

If SMTP and forgot password are enabled, use the forgot password flow. Otherwise, temporarily configure a new admin bootstrap account or update the database manually.

#### Emails Are Not Sent

Check SMTP host, port, username, password, sender address, and `SMTP_SECURE`. You can configure these in `.env` or in `/admin/email`. If the sender address is empty, the app uses `SMTP_USERNAME`; many providers require the sender to match the SMTP account or a verified alias.

When email verification is enabled, users must request and enter an email code during registration. A user account is created only after the code is accepted. If the code email fails, no user is created.

#### Turnstile Reports Missing Configuration

If Turnstile is enabled, both site key and secret key are required. You can temporarily disable Turnstile in admin settings.

#### `/favicon.ico` Returns 404

The repository includes `public/favicon.ico`. Rebuild the image and confirm the app is serving the latest code.

### Security Notes

- Do not commit a real `.env`.
- Do not upload real database passwords, JWT secrets, SMTP passwords, or Turnstile secrets.
- Review the generated admin email and password before public deployment.
- Plan carefully before rotating `APP_SECRET`; encrypted settings depend on it.
