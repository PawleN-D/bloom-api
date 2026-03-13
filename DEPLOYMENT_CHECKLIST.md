# Render Deployment Checklist

## Phase 1: Initial Setup (5 minutes)

- [ ] Create Render account at https://render.com
- [ ] Connect your GitHub account
- [ ] Authorize Render to access your repositories

## Phase 2: Create PostgreSQL Database (2 minutes)

- [ ] In Render dashboard, click **New +** → **PostgreSQL**
- [ ] **Name**: bloom-db
- [ ] **Database**: bloom_db
- [ ] **User**: bloom_user
- [ ] **Region**: Choose closest to you
- [ ] **Leave other defaults**
- [ ] Click **Create Database**
- [ ] ⏳ Wait 2-3 minutes for database to be ready
- [ ] **Copy the Internal Database URL** (you'll need this)

## Phase 3: Deploy Web Service (5 minutes)

- [ ] Click **New +** → **Web Service**
- [ ] **Connect Repository**: Select your bloom-api GitHub repo
- [ ] Click **Connect**
- [ ] **Name**: bloom-api
- [ ] **Environment**: Node
- [ ] **Region**: Same as database
- [ ] **Branch**: main (or your default branch)
- [ ] **Build Command**: `npm install && npm run build`
- [ ] **Start Command**: `npm start`
- [ ] **Plan**: Free tier (or Starter if free is too slow)
- [ ] Click **Create Web Service**

## Phase 4: Configure Environment Variables (5 minutes)

After Web Service is created:
- [ ] Go to **Environment** tab
- [ ] Click **Add Environment Variable**
- [ ] Add these variables:

```
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
BASE_DOMAIN=yourdomain.com
FRONTEND_URL=https://your-frontend.pages.dev
FRONTEND_URLS=https://your-frontend.pages.dev
DATABASE_URL=postgres://bloom_user:PASSWORD@internal-host:5432/bloom_db
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
RESEND_API_KEY=<get from resend.com>
FROM_EMAIL=noreply@yourdomain.com
REDIS_URL=redis://localhost:6379
```

- [ ] **Get the DATABASE_URL** from your PostgreSQL database page (Internal Database URL)
- [ ] **Paste it** into Environment Variables
- [ ] Save

## Phase 5: Run Migrations (5 minutes)

- [ ] Go to Web Service **Settings** tab
- [ ] Scroll to **Deploy Hooks**
- [ ] Add Pre-deployment Hook:
  ```
  npm run prisma:migrate:prod && npm run prisma:seed
  ```
- [ ] Save

**Or run manually:**
- [ ] Click **Shell** tab
- [ ] Run: `npm run prisma:migrate:prod`
- [ ] Run: `npm run prisma:seed`

## Phase 6: Wait for Deployment (10 minutes)

- [ ] Go back to **Deployments** tab
- [ ] Watch the build progress
- [ ] ✅ Should say "Deploy Successful"
- [ ] Copy your **Render App URL** (format: bloom-api-xxxxx.onrender.com)

## Phase 7: Test Your API (2 minutes)

- [ ] Visit: `https://bloom-api-xxxxx.onrender.com`
- [ ] Should see your API response or health check
- [ ] Test one of your endpoints

## Phase 8: Connect to Frontend (2 minutes)

- [ ] Update frontend `.env`:
  ```
  VITE_API_URL=https://bloom-api-xxxxx.onrender.com
  ```
- [ ] Deploy frontend to Cloudflare Pages
- [ ] Test API calls from frontend

## Phase 9: Custom Domain (Optional, 2 minutes)

- [ ] In Web Service settings, go to **Custom Domain**
- [ ] Add your domain: `api.yourdomain.com`
- [ ] Add **CNAME record** in your DNS provider:
  - [ ] Name: `api`
  - [ ] Value: `bloom-api-xxxxx.onrender.com`
- [ ] Wait 5-10 minutes for DNS
- [ ] Test: `curl https://api.yourdomain.com`

## Problem: Free Tier Spins Down

⚠️ **Render free tier** spins down after 15 minutes of inactivity (API returns 502)

**Solutions:**
1. **Upgrade to Starter** ($7/month) - always on
2. **Keep it on free** - use a pinger service (like Uptime Robot) to keep it awake
3. **Accept 15-second cold start** for free usage

To keep free tier awake:
- [ ] Sign up for Uptime Robot (free): https://uptimerobot.com
- [ ] Create monitor for: `https://bloom-api-xxxxx.onrender.com`
- [ ] Set check interval to 5 minutes
- [ ] This keeps your app running 24/7 for free

## Post-Deployment

- [ ] ✅ Test all API endpoints
- [ ] ✅ Test file uploads
- [ ] ✅ Test email notifications  
- [ ] ✅ Test PDF generation
- [ ] ✅ Monitor logs: Click **Logs** in Render dashboard

## Estimated Total Time: 30 minutes

Most of this is waiting for build/deployment.

---

**Once complete, you have:**
- ✅ Free web server on Render
- ✅ Free PostgreSQL database
- ✅ Free HTTPS
- ✅ Auto-deploys from GitHub (git push = live update)
- ✅ API accessible globally at `https://api.yourdomain.com`
- ✅ ~$10/year cost (just domain, server is FREE)

**Note:** Free tier apps spin down after 15 mins of inactivity. Use Uptime Robot to keep awake, or upgrade to Starter ($7/month).

---

## Troubleshooting

**Build failed?**
- Click **Deployments** → latest failed deployment
- View logs to see error
- Common: missing environment variable

**App won't start?**
- Check **Logs** tab for errors
- Verify `npm start` command works locally
- Check DATABASE_URL is correct

**Database connection fails?**
- Use **Internal Database URL** (not External)
- Format: `postgres://user:password@host:5432/db`
- Verify password has no special characters

**Cold start/502 errors?**
- Get Uptime Robot to ping every 5 minutes
- Or upgrade to paid tier

---

## Commands Reference

Deploy new code: `git push` (auto-deploys)
View logs: Click **Logs** tab
Restart app: Click **Manual Deploy**
Check database: Click **Database** → **Browser**
