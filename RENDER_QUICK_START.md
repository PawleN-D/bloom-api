# Render Deployment - 30 Minute Setup

**Ultra-simple Render deployment for Bloom API**

## Step 1: Create Accounts (5 minutes)

1. Sign up at https://render.com
2. Connect your GitHub account
3. Authorize Render access

## Step 2: Deploy Database (2 minutes)

1. Dashboard → **New +** → **PostgreSQL**
2. Fill in:
   - Name: `bloom-db`
   - Database: `bloom_db`
   - User: `bloom_user`
3. Click **Create Database**
4. ⏳ Wait 2-3 minutes
5. **Copy Internal Database URL** when ready

## Step 3: Deploy App (3 minutes)

1. Dashboard → **New +** → **Web Service**
2. **Connect Repository** → Select `bloom-api`
3. Fill in:
   - Name: `bloom-api`
   - Environment: `Node`
   - Region: Same as database
   - Branch: `main`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
4. Click **Create Web Service**
5. ⏳ Building... (takes 5-10 minutes)

## Step 4: Add Environment Variables (2 minutes)

In Web Service → **Environment** tab, add:

```
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

DATABASE_URL=postgres://bloom_user:PASSWORD@INTERNAL_HOST:5432/bloom_db
JWT_SECRET=YOUR_GENERATED_SECRET
FRONTEND_URL=https://your-frontend.pages.dev
FRONTEND_URLS=https://your-frontend.pages.dev
BASE_DOMAIN=yourdomain.com
RESEND_API_KEY=your_api_key
FROM_EMAIL=noreply@yourdomain.com
```

**Get DATABASE_URL from:**
- Go to PostgreSQL instance page
- Copy "Internal Database URL"
- Paste into DATABASE_URL variable

## Step 5: Run Migrations (3 minutes)

Go to Web Service → **Shell** tab

Run:
```bash
npm run prisma:migrate:prod
npm run prisma:seed
```

## Step 6: Done! 🎉

Your app is now live at: `https://bloom-api-xxxxx.onrender.com`

Test it:
```bash
curl https://bloom-api-xxxxx.onrender.com
```

## Step 7: Connect Frontend (2 minutes)

Update your frontend `.env`:
```
VITE_API_URL=https://bloom-api-xxxxx.onrender.com
```

Deploy frontend to Cloudflare Pages → done!

---

## Optional: Custom Domain

1. Web Service → Settings → **Custom Domain**
2. Add: `api.yourdomain.com`
3. In your DNS provider:
   - Add CNAME: `api` → `bloom-api-xxxxx.onrender.com`
4. Wait 5 minutes, test

---

## ⚠️ Free Tier Note

Render free tier **spins down after 15 min of inactivity** (returns 502 error)

**To fix:**
- Go to Uptime Robot (https://uptimerobot.com) - free account
- Add monitor for your Render URL
- Set to ping every 5 minutes
- Keeps your app awake 24/7 for free!

Or upgrade to Starter ($7/month) for always-on.

---

## That's It!

**Total cost:** Just your domain (~$10/year)
**Total time:** 30 minutes
**Deploy updates:** Just `git push` to main

---

## Helpful Commands

```bash
# View logs
Click "Logs" in Render dashboard

# Restart app
Click "Manual Deploy"

# Update code
git push (auto-deploys)

# Run migrations
Click "Shell" → npm run prisma:migrate:prod

# Check database
Click PostgreSQL → "Browser"
```

Done! Your API is now live and accessible globally. 🚀
