# Deployment Guide — IArdoise

This guide covers deploying IArdoise to production on various platforms: Docker (recommended), Node.js, Railway, Render, or Vercel.

> **📝 Latest Update (2026-07-22)**: Railway configuration simplified. Root-level `package.json` and `start.sh` enable automatic detection and deployment without Procfile or custom build scripts. See [Option 2: Railway.app](#-option-2-railwayapp).

---

## 📋 Pre-Deployment Checklist

- [ ] Environment variables set (`.env` with all required values)
- [ ] Backend built and tested (`npm run build && npm test`)
- [ ] Frontend built and tested (`npm run build:frontend`)
- [ ] All dependencies up-to-date (`npm audit`)
- [ ] Node.js 20 LTS confirmed available on target platform
- [ ] Domain/URL for production noted (for CORS, WebSocket, PWA manifest)

---

## 🐳 Option 1: Docker (Recommended)

### Build Docker Image

Create `Dockerfile` at project root:

```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN npm ci

# Build frontend
COPY frontend ./frontend
RUN npm run build --workspace=frontend

# Build backend
COPY backend ./backend
RUN npm run build --workspace=backend

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies only
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN npm ci --omit=dev

# Copy built artifacts
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/backend/dist ./backend/dist
COPY backend/src ./backend/src

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start backend (serves frontend)
CMD ["npm", "start", "--workspace=backend"]
```

### Build & Run Locally

```bash
# Build image
docker build -t iardoise:latest .

# Run container
docker run \
  -p 3000:3000 \
  -e HOST_USERNAME=admin \
  -e HOST_PASSWORD_HASH="<bcryptjs hash>" \
  -e JWT_SECRET="<32+ random chars>" \
  iardoise:latest
```

Visit `http://localhost:3000`

### Push to Docker Registry

```bash
# Login to registry (e.g., Docker Hub)
docker login

# Tag image
docker tag iardoise:latest your-username/iardoise:latest

# Push
docker push your-username/iardoise:latest
```

---

## 🚀 Option 2: Railway.app

Railway is a Git-connected platform for Node.js deployments. The repo is pre-configured with `start.sh` and root-level `package.json` for automatic detection.

### 1. Connect Repository

1. Go to [railway.app](https://railway.app)
2. Click **New Project** → **Deploy from GitHub**
3. Authorize Railway to access your GitHub repo
4. Select `FRmicrow/IArdoise`

### 2. Configure Environment

In Railway dashboard:
1. Click **Variables**
2. Add:
   ```
   HOST_USERNAME=admin
   HOST_PASSWORD_HASH=<bcryptjs hash>
   JWT_SECRET=<32+ random chars>
   NODE_ENV=production
   ```
   ⚠️ Do **not** set `PORT` — Railway assigns it automatically

### 3. Deployment Structure

The repo includes:
- **`package.json`** (root) — Declares Node.js runtime and install script
- **`start.sh`** (root) — Entry point that builds and starts the app from `IArdoise/`

```bash
# start.sh flow:
# 1. cd IArdoise
# 2. npm run build (frontend + backend)
# 3. npm start (backend only, serves compiled frontend)
```

Railway auto-detects this structure and runs `npm start` on deployment.

### 4. Deploy

Push to GitHub:
```bash
git push origin master
```

Railway auto-detects Node.js runtime (via root `package.json`), installs dependencies, and executes `start.sh`. View logs in Railway dashboard.

### Troubleshooting Railway

| Issue | Solution |
|-------|----------|
| Build fails: "Cannot find module" | Delete `node_modules` and `package-lock.json`, then push again. Railway reinstalls on redeploy. |
| "Script start.sh not found" | Ensure `start.sh` is at repo root and committed (`git add start.sh`). |
| Port binding error | Port is auto-assigned by Railway. Remove any hardcoded `PORT=3000` from env vars. |

---

## 🟢 Option 3: Render

Render is another Git-connected PaaS platform.

### 1. Create Web Service

1. Go to [render.com](https://render.com)
2. Click **New** → **Web Service**
3. Connect GitHub repo `FRmicrow/IArdoise`
4. Choose runtime: **Node.js 20**

### 2. Configure Build & Start Commands

- **Build Command**:
  ```bash
  cd IArdoise && npm install && npm run build
  ```
- **Start Command**:
  ```bash
  cd IArdoise && npm start
  ```

### 3. Add Environment Variables

Under **Environment**:
```
HOST_USERNAME=admin
HOST_PASSWORD_HASH=<bcryptjs hash>
JWT_SECRET=<32+ random chars>
PORT=3000
NODE_ENV=production
```

### 4. Deploy

Click **Create Web Service**. Render automatically deploys on push to GitHub.

---

## 🟦 Option 4: Node.js (VPS/Server)

For AWS EC2, DigitalOcean, Linode, or similar VPS:

### 1. SSH into Server

```bash
ssh user@your-server-ip
```

### 2. Install Node.js 20

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs npm
```

### 3. Clone Repository

```bash
git clone https://github.com/FRmicrow/IArdoise.git
cd IArdoise
```

### 4. Setup Environment

```bash
cd IArdoise
cp .env.example .env
# Edit .env with production values
nano .env
```

### 5. Install & Build

```bash
npm install
npm run build
```

### 6. Start Application

#### Option A: Direct Start
```bash
npm start
```

#### Option B: PM2 (Process Manager)
```bash
sudo npm install -g pm2

pm2 start "npm start --workspace=backend" --name iardoise --cwd ./IArdoise

pm2 startup
pm2 save
```

View logs:
```bash
pm2 logs iardoise
```

#### Option C: Systemd Service

Create `/etc/systemd/system/iardoise.service`:

```ini
[Unit]
Description=IArdoise Drawing Game
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/home/user/IArdoise
ExecStart=/usr/bin/npm start --workspace=backend
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment="NODE_ENV=production"
Environment="HOST_USERNAME=admin"
Environment="HOST_PASSWORD_HASH=<hash>"
Environment="JWT_SECRET=<secret>"

[Install]
WantedBy=multi-user.target
```

Enable & start:
```bash
sudo systemctl enable iardoise
sudo systemctl start iardoise
sudo systemctl status iardoise
```

### 7. Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Reverse proxy to backend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }
}
```

Reload Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 8. Enable HTTPS (Let's Encrypt)

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d your-domain.com
```

---

## 🌐 Environment Variables Reference

| Variable | Value | Notes |
|----------|-------|-------|
| `HOST_USERNAME` | `admin` | Login username |
| `HOST_PASSWORD_HASH` | bcryptjs hash | Generate: `node -e "require('bcryptjs').hash('password', 10).then(console.log)"` |
| `JWT_SECRET` | 32+ random chars | Generate: `openssl rand -hex 32` |
| `PORT` | `3000` | Backend port |
| `NODE_ENV` | `production` | Set to `production` for prod, `development` for dev |
| `CORS_ORIGIN` | `https://your-domain.com` | Allowed origin for CORS (optional, auto-set) |

---

## 🔍 Post-Deployment Verification

### Health Check
```bash
curl https://your-domain.com/api/health
# Expected: 200 OK
```

### Login Test
```bash
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<your-password>"}'
# Expected: {"token":"<JWT>"}
```

### WebSocket Test
```bash
# Use browser console or WebSocket client
const ws = new WebSocket('wss://your-domain.com/ws?token=<JWT>');
ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log('Message:', e.data);
```

---

## 📊 Monitoring & Logs

### Docker
```bash
docker logs -f <container-id>
```

### PM2
```bash
pm2 logs iardoise
```

### Systemd
```bash
journalctl -u iardoise -f
```

### Application Errors
Check backend logs for:
- JWT validation errors
- WebSocket connection failures
- Session not found errors

---

## 🛡️ Security Checklist

- [ ] HTTPS enabled (cert from Let's Encrypt)
- [ ] `HOST_PASSWORD_HASH` is bcryptjs-hashed (not plaintext)
- [ ] `JWT_SECRET` is 32+ random characters
- [ ] CORS configured for production domain only
- [ ] Environment variables set on deployment platform (not in `.env`)
- [ ] `.env` file excluded from version control (in `.gitignore`)
- [ ] Firewall allows ports 80/443 (block others)
- [ ] Regular security updates for Node.js packages

---

## 🔧 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=8080 npm start
```

### WebSocket Connection Fails
- Ensure HTTPS is enabled (WSS required in production)
- Check reverse proxy allows WebSocket upgrade headers
- Verify JWT token is sent with connection

### Build Fails
```bash
# Clear cache & reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### "EACCES: permission denied"
```bash
# Ensure app directory is writable
chmod -R 755 /path/to/iardoise
```

---

## 📈 Scaling

For high traffic (100+ concurrent users):

1. **Load Balancer** — Distribute traffic across multiple backend instances
2. **Session Store** — Replace in-memory with Redis
3. **Database** — Add PostgreSQL for persistent session logs
4. **CDN** — Cache frontend assets (CloudFront, Cloudflare)

See [ARCHITECTURE.md](ARCHITECTURE.md) for scaling architecture.

---

## 🚨 Rollback

### Docker
```bash
docker pull your-username/iardoise:previous-tag
docker run ... your-username/iardoise:previous-tag
```

### Git-based (Railway, Render)
Click **Revert** in deployment dashboard to rollback to previous commit.

### Manual Rollback
```bash
git log --oneline
git checkout <previous-commit>
npm run build
npm start
```

---

## ✅ Next Steps

1. Deploy using one of the options above
2. Run [Post-Deployment Verification](#-post-deployment-verification)
3. Share production URL with players
4. Monitor logs for errors
5. Set up alerts for downtime

For questions, see [README.md](README.md) and [ARCHITECTURE.md](ARCHITECTURE.md).
