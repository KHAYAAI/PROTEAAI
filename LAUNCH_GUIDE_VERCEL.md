# ProteaAI Launch Guide — Vercel

**Estimated time: 45-60 minutes**  
**Difficulty: Beginner-friendly**  
**Cost: $5-50/month** (depends on usage)

This guide walks you through launching ProteaAI on Vercel (serverless) with Neon PostgreSQL.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Generate Secret Keys](#generate-secret-keys)
3. [Setup Neon PostgreSQL Database](#setup-neon-postgresql-database)
4. [Create Vercel Account](#create-vercel-account)
5. [Deploy to Vercel](#deploy-to-vercel)
6. [Configure Environment Variables](#configure-environment-variables)
7. [Run Database Migrations](#run-database-migrations)
8. [Verify Deployment](#verify-deployment)
9. [Setup Custom Domain](#setup-custom-domain-optional)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, you need:

- [ ] **Git** installed
  ```bash
  git --version
  ```

- [ ] **Node.js** v24 installed
  ```bash
  node --version  # Should show v24.x.x
  ```

- [ ] **GitHub account** (required for Vercel)
  - Go to https://github.com/signup

- [ ] **Vercel account** (free, created via GitHub)

- [ ] **Neon account** (free PostgreSQL database)
  - Go to https://neon.tech/

Optional:
- [ ] Domain name (can use Vercel's free domain first)
- [ ] Stripe account (for paid subscriptions)

---

## Step 1: Generate Secret Keys

You need two random 64-character hex strings for encryption and JWT signing.

### Using OpenSSL (macOS/Linux)

Open terminal:

```bash
# Generate JWT_SECRET
openssl rand -hex 32
# Output example: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f
# ↑ Copy this entire string

# Generate SECRET_KEY  
openssl rand -hex 32
# Output example: x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4z3y2x1w0v
# ↑ Copy this entire string
```

### Using Node.js (All platforms)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy output → JWT_SECRET

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy output → SECRET_KEY
```

### Using PowerShell (Windows)

```powershell
[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

### Save Your Secrets

Create a local text file (NOT in git):

```
JWT_SECRET=a1b2c3d4e5f6...
SECRET_KEY=x9y8z7w6v5u4...
DATABASE_URL=postgresql://user:pass@...
```

**Never commit these to Git!**

---

## Step 2: Setup Neon PostgreSQL Database

Neon provides a free PostgreSQL database perfect for Vercel.

### 2.1 Create Neon Account

1. Go to https://neon.tech/
2. Click **Sign Up**
3. Choose **Sign up with GitHub**
4. Authorize Neon to access your GitHub
5. Create your project name (e.g., `proteaai-prod`)

### 2.2 Create Database

1. After sign-up, you'll see a "Create a project" screen
2. **Project name:** `proteaai-prod`
3. **Database name:** Keep default `neondb`
4. **Branch:** Keep default `main`
5. Click **Create project**

### 2.3 Get Connection String

After project creation:

1. You'll see the connection string displayed
2. Look for: **Connection string** → **Pooling** → **PostgreSQL**
3. Copy the entire URL (starts with `postgresql://`)

Example:
```
postgresql://neondb_owner:abcd1234@ep-cool-cloud-12345.us-east-1.neon.tech/neondb?sslmode=require
```

Keep this safe — you'll need it for Vercel!

### 2.4 Test Connection (Optional)

```bash
# Install psql if you don't have it:
# macOS: brew install postgresql
# Linux: sudo apt-get install postgresql-client
# Windows: https://www.postgresql.org/download/windows/

# Test connection:
psql "postgresql://neondb_owner:password@ep-cool-cloud.us-east-1.neon.tech/neondb"

# Inside psql:
\dt  # List tables (should be empty)
\q   # Quit
```

---

## Step 3: Clone ProteaAI Repository

```bash
# Clone the repository
git clone https://github.com/KHAYAAI/PROTEAAI.git
cd PROTEAAI

# Or if you have a fork:
git clone https://github.com/YOUR-USERNAME/PROTEAAI.git
cd PROTEAAI
```

Verify the repo has the necessary Vercel files:

```bash
ls -la | grep vercel
# Should show: api, vercel.json

ls -la api/
# Should show: server.ts
```

---

## Step 4: Create Vercel Account & Link GitHub

### 4.1 Create Vercel Account

1. Go to https://vercel.com
2. Click **Sign Up**
3. Choose **Continue with GitHub**
4. Authorize Vercel to access your GitHub account
5. Complete the onboarding

### 4.2 Import Repository

1. Go to https://vercel.com/new
2. Search for your repository (`PROTEAAI` or your fork)
3. Click **Import**

Vercel will detect the Vercel configuration automatically.

---

## Step 5: Configure Environment Variables in Vercel

### 5.1 In Vercel Dashboard

1. After clicking Import, you'll see **Environment Variables** section
2. Add each variable one by one:

#### Required Variables

**JWT_SECRET:**
- **Name:** `JWT_SECRET`
- **Value:** Paste your 64-char hex string from Step 1
- Click **Add**

**SECRET_KEY:**
- **Name:** `SECRET_KEY`
- **Value:** Paste your 64-char hex string from Step 1
- Click **Add**

**DATABASE_URL:**
- **Name:** `DATABASE_URL`
- **Value:** Paste the Neon connection string from Step 2.3
  - Example: `postgresql://neondb_owner:abcd1234@ep-cool-cloud-12345.us-east-1.neon.tech/neondb?sslmode=require`
- Click **Add**

**NODE_ENV:**
- **Name:** `NODE_ENV`
- **Value:** `production`
- Click **Add**

**CORS_ORIGIN:**
- **Name:** `CORS_ORIGIN`
- **Value:** Your domain (for now: `https://your-app.vercel.app`)
- Click **Add**

**APP_BASE_URL:**
- **Name:** `APP_BASE_URL`
- **Value:** Your domain (for now: `https://your-app.vercel.app`)
- Click **Add**

#### Optional Variables (Stripe)

If you have a Stripe account:

**STRIPE_SECRET_KEY:**
- **Name:** `STRIPE_SECRET_KEY`
- **Value:** Your Stripe secret key (starts with `sk_live_`)
- Click **Add**

**STRIPE_WEBHOOK_SECRET:**
- **Name:** `STRIPE_WEBHOOK_SECRET`
- **Value:** Your Stripe webhook secret (starts with `whsec_`)
- Click **Add**

**STRIPE_PRO_PRICE_ID:**
- **Name:** `STRIPE_PRO_PRICE_ID`
- **Value:** Your Stripe price ID (starts with `price_`)
- Click **Add**

### 5.2 Screenshot Checklist

Variables should look like:
```
JWT_SECRET       = a1b2c3d4e5f6... (64 chars)
SECRET_KEY       = x9y8z7w6v5u4... (64 chars)
DATABASE_URL     = postgresql://... (from Neon)
NODE_ENV         = production
CORS_ORIGIN      = https://your-app.vercel.app
APP_BASE_URL     = https://your-app.vercel.app
STRIPE_SECRET_KEY = sk_live_... (optional)
```

---

## Step 6: Deploy

### 6.1 Click Deploy

1. After adding all environment variables
2. Click the **Deploy** button
3. Vercel will:
   - Build the React frontend
   - Build the Node.js backend
   - Run `npm run vercel-build` (includes migrations)
   - Start the serverless functions

**First deploy takes 5-10 minutes.**

### 6.2 Watch Deployment

1. You'll see a progress screen
2. Click on the **Deployments** tab to watch
3. When done, you'll see: **✓ Production Deployment Complete**

---

## Step 7: Get Your App URL

After deployment completes:

1. You'll see your app URL: `https://your-app-name.vercel.app`
2. Click the URL to open your app
3. You should see the ProteaAI login page

---

## Step 8: Run Database Migrations

Vercel runs migrations automatically during build (via `npm run vercel-build`).

But to verify migrations ran correctly:

### Option A: Check via Neon Console

1. Go to https://console.neon.tech
2. Click your project
3. Click **Tables**
4. You should see tables: `users`, `subscriptions`, `apps`, `chats`, `messages`, etc.

### Option B: Check via psql

```bash
psql "YOUR_DATABASE_URL"

# Inside psql:
\dt  # List all tables
SELECT table_name FROM information_schema.tables WHERE table_schema='public';
\q
```

### Option C: Check via Application Logs

```bash
# If using Vercel CLI:
vercel logs

# Look for: "[db] Running migrations from..."
# Then: Migration 0000, 0001, ... 0031 completed
```

---

## Step 9: Verify Deployment

### Test Health Endpoint

```bash
curl https://your-app-name.vercel.app/health
# Expected: { "ok": true, "version": "..." }
```

### Test Web App

1. Open https://your-app-name.vercel.app
2. You should see the login page
3. Try signing up:
   - Email: test@example.com
   - Password: TestPassword123!
   - Name: Test User
4. Click Sign Up
5. You should be logged in and redirected to dashboard

### Test API Endpoint

```bash
# Get JWT token from signup/login
# Then test /auth/me endpoint:

curl https://your-app-name.vercel.app/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Should return your user data
```

---

## Step 10: Setup Custom Domain (Optional)

If you have a custom domain (e.g., `app.yourdomain.com`):

### 10.1 Add Domain in Vercel

1. Go to your Vercel project settings
2. Click **Domains**
3. Enter your domain: `yourdomain.com`
4. Click **Add**

### 10.2 Update DNS at Your Registrar

Vercel will show DNS records to add. Follow these steps:

1. Go to your domain registrar (GoDaddy, Namecheap, Route53, etc.)
2. Find **DNS settings**
3. Add the records Vercel shows:
   - Usually: CNAME record pointing to `cname.vercel-dns.com`
4. Wait for DNS to propagate (5-30 minutes)

### 10.3 Verify Domain

Back in Vercel:
- Wait a few minutes
- You'll see checkmarks next to DNS records when verified
- Your app will be accessible at `https://yourdomain.com`

### 10.4 Update Environment Variables

Update CORS_ORIGIN and APP_BASE_URL:

1. Go to **Settings** → **Environment Variables**
2. Edit `CORS_ORIGIN` → Change to `https://yourdomain.com`
3. Edit `APP_BASE_URL` → Change to `https://yourdomain.com`
4. Redeploy: Click **Redeploy** or push a change to GitHub

---

## Step 11: Setup Stripe Webhook (Optional)

If using Stripe for payments:

### 11.1 Get Webhook Endpoint URL

In Vercel, your webhook URL will be:
```
https://your-app.vercel.app/billing/webhook
```

### 11.2 Configure in Stripe Dashboard

1. Go to https://dashboard.stripe.com
2. Click **Developers** → **Webhooks**
3. Click **Add Endpoint**
4. **Endpoint URL:** `https://your-app.vercel.app/billing/webhook`
5. **Events to send:**
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
6. Click **Add Endpoint**
7. Copy the **Signing secret** (starts with `whsec_`)

### 11.3 Update Stripe Secrets in Vercel

1. Go to Vercel Project Settings
2. **Environment Variables**
3. Add/Update:
   - `STRIPE_WEBHOOK_SECRET` = The signing secret you just copied
4. Redeploy

---

## Step 12: Enable Automatic Deployments

Vercel automatically deploys when you push to GitHub!

### How It Works

1. You push code to GitHub
2. GitHub notifies Vercel
3. Vercel automatically builds and deploys
4. Your app is updated in seconds

### Disable Auto-Deploy (if needed)

1. Project Settings → **Git**
2. Turn off **Automatic Deployments**

---

## Step 13: Monitor Your App

### View Logs

```bash
# If you installed Vercel CLI:
npm i -g vercel
vercel login

# Watch live logs:
vercel logs --follow

# Filter for errors:
vercel logs --grep "ERROR"
```

### Or in Vercel Dashboard

1. Click your project
2. **Deployments** tab → Click a deployment
3. **Logs** tab to see build and runtime logs

---

## Step 14: Scaling & Performance

### Cron Jobs (Optional)

Vercel supports scheduled functions (cron jobs) for tasks like:
- Cleanup old database records
- Send reminder emails
- Backup data

To add a cron job, create `api/cron.ts`:

```typescript
import { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron job token
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Your scheduled task here
  console.log("Cron job running");

  res.json({ success: true });
}
```

Then configure in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### Database Connection Pooling

Vercel's serverless functions benefit from connection pooling. Neon includes this automatically with the Pooling connection string.

---

## Troubleshooting

### Issue: Build Fails with "JWT_SECRET not set"

**Error:** `Error: JWT_SECRET environment variable is required`

**Solution:**
1. Go to Vercel Project Settings
2. **Environment Variables**
3. Verify `JWT_SECRET` is set (64 hex characters)
4. Redeploy: Click **Redeploy** on a deployment

### Issue: Database Migrations Failed

**Error:** `Failed to run migrations`

**Solution:**
1. Check DATABASE_URL is correct:
   ```bash
   echo $DATABASE_URL  # Should show postgresql://...
   ```

2. Verify Neon database is running:
   - Go to https://console.neon.tech
   - Check project status (should be green)

3. Test connection manually:
   ```bash
   psql "DATABASE_URL"
   \dt  # List tables
   ```

4. Redeploy and check logs:
   ```bash
   vercel logs --grep "migration"
   ```

### Issue: "Cannot find module '@neondatabase/serverless'"

**Error:** Module not found

**Solution:**
```bash
# Reinstall dependencies
npm install

# Commit and push
git add package-lock.json
git commit -m "Update dependencies"
git push

# Vercel will auto-redeploy
```

### Issue: Cold Starts (Slow Initial Load)

**Symptoms:** First request takes 5-10 seconds

**Cause:** Serverless functions start on first request

**Solution:** This is normal for serverless. Subsequent requests are fast.

**Optimization:**
- Upgrade Vercel Pro for faster CPUs
- Or use Fly.io for always-warm servers

### Issue: Database Connection Timeout

**Error:** `connect ECONNREFUSED` or `Connection timeout`

**Solution:**
1. Check DATABASE_URL includes `?sslmode=require`
2. Verify Neon database is running
3. Check IP whitelist in Neon Console (should allow all IPs for Vercel)

### Issue: Blank Page or 500 Error

**Error:** App shows blank page or error

**Solution:**
1. Check Vercel logs:
   ```bash
   vercel logs
   ```

2. Check browser console for errors (F12)

3. Check environment variables are set:
   ```bash
   vercel env list
   ```

4. Verify migrations ran:
   - Check Neon Console for tables

### Issue: "Invalid connection string"

**Error:** Connection string format error

**Solution:**
Neon connection string should look like:
```
postgresql://neondb_owner:password@ep-cool-cloud-12345.us-east-1.neon.tech/neondb?sslmode=require
```

Not:
```
postgres://...  (old format, use postgresql://)
```

---

## Performance Tips

### 1. Enable Compression

Vercel does this automatically.

### 2. Optimize Database Queries

```typescript
// Good: Select only needed columns
db.select({ id: users.id, email: users.email }).from(users);

// Bad: Select everything
db.select().from(users);
```

### 3. Use Caching

```typescript
// Cache responses for 60 seconds
res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
```

### 4. Monitor Cold Starts

In Vercel Analytics, watch for "Cold Starts" metric. If high:
- Upgrade to Vercel Pro (faster CPUs)
- Move to Fly.io (always-warm)

---

## Cost Breakdown

| Component | Cost | Notes |
|-----------|------|-------|
| **Vercel** | **Free** | Includes 100GB bandwidth |
| Excess bandwidth | $0.50/GB | After 100GB |
| **Neon** | **Free Tier** | Includes 3GB storage, 500MB compute |
| Neon paid | $14/month+ | Extra storage/compute |
| **Stripe** | 2.9% + $0.30 | Per transaction |
| **Total** | **$0-50/month** | Depending on usage |

---

## Database Backups

### Manual Backup

```bash
# Backup Neon database
pg_dump "DATABASE_URL" > backup.sql

# This creates a SQL dump file
ls -lh backup.sql
```

### Restore Backup

```bash
# Create backup file
echo 'SQL commands...' > backup.sql

# Restore to Neon
psql "DATABASE_URL" < backup.sql
```

### Automatic Backups

Neon includes automatic point-in-time recovery (last 7 days on free tier).

To access in Neon Console:
1. Click your project
2. Click **Backups**
3. See available snapshots

---

## Next Steps

1. **Test thoroughly**: Sign up, create apps, test all features
2. **Setup monitoring**: Enable Vercel Analytics
3. **Setup backups**: Regular database exports
4. **Configure Stripe** (optional): For paid plans
5. **Custom domain**: Point your domain to the app
6. **Scaling**: Monitor usage and upgrade resources if needed

---

## Cheat Sheet

```bash
# Useful Vercel CLI commands
vercel login                    # Login to Vercel
vercel                          # Deploy current branch
vercel --prod                   # Deploy to production
vercel logs                     # View app logs
vercel logs --follow            # Watch live logs
vercel env list                 # List environment variables
vercel env add NAME value       # Add environment variable
vercel rollback                 # Rollback to previous deployment
vercel remove                   # Delete project

# PostgreSQL/Neon commands
psql "$DATABASE_URL"            # Connect to database
\dt                             # List tables
\d table_name                   # Describe table
SELECT * FROM users LIMIT 5;    # Query users
\q                              # Quit psql
```

---

## Support

- **Vercel Docs:** https://vercel.com/docs
- **Neon Docs:** https://neon.tech/docs
- **ProteaAI Issues:** https://github.com/KHAYAAI/PROTEAAI/issues
- **Vercel Community:** https://github.com/vercel/vercel/discussions

---

**Congratulations!** Your ProteaAI app is now live on Vercel! 🚀
