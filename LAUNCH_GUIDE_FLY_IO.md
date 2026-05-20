# ProteaAI Launch Guide — Fly.io

**Estimated time: 30-45 minutes**  
**Difficulty: Beginner-friendly**  
**Cost: $5-20/month**

This guide walks you through launching ProteaAI on Fly.io from scratch. No prior experience required.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Generate Secret Keys](#generate-secret-keys)
3. [Create Fly.io Account](#create-flyio-account)
4. [Build Docker Image](#build-docker-image)
5. [Deploy to Fly.io](#deploy-to-flyio)
6. [Configure Secrets](#configure-secrets)
7. [Run Migrations](#run-migrations)
8. [Verify Deployment](#verify-deployment)
9. [Setup Custom Domain](#setup-custom-domain-optional)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, you need:

- [ ] **Git** installed (to clone the repo)
  ```bash
  git --version  # Should show version number
  ```

- [ ] **Node.js** (v24) installed
  ```bash
  node --version  # Should show v24.x.x
  npm --version   # Should show 10.x or higher
  ```

- [ ] **Docker** installed (for building container image)
  ```bash
  docker --version  # Should show Docker version
  ```

- [ ] **Fly.io account** (free to create)
- [ ] **GitHub account** (optional, but recommended)
- [ ] **Domain name** (optional, can use Fly.io's free domain)

### Install flyctl (Fly.io CLI)

macOS:
```bash
brew install flyctl
```

Linux:
```bash
curl -L https://fly.io/install.sh | sh
```

Windows (PowerShell):
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

Verify installation:
```bash
flyctl version  # Should show version number
```

---

## Step 1: Generate Secret Keys

You need two random secret keys for encryption and JWT signing.

### Option A: Using OpenSSL (Recommended)

Open terminal/command prompt and run:

```bash
# Generate JWT_SECRET (64-character hex string)
openssl rand -hex 32
# Output: a1b2c3d4e5f6g7h8... (copy this entire string)

# Generate SECRET_KEY (64-character hex string)
openssl rand -hex 32
# Output: x9y8z7w6v5u4t3s2... (copy this entire string)
```

### Option B: Using Node.js

If you don't have OpenSSL:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy the output for JWT_SECRET

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy the output for SECRET_KEY
```

### Save Your Secrets Somewhere Safe

Create a file on your computer (NOT in git) to keep these:

```
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f
SECRET_KEY=x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4z3y2x1w0v

Example values - DO NOT USE IN PRODUCTION
```

**IMPORTANT:** Never share these secrets or commit them to git!

---

## Step 2: Create Fly.io Account

1. Go to https://fly.io
2. Click **Sign Up**
3. Enter your email and create a password
4. Check your email and verify your account
5. Create your organization name (e.g., your-name, your-company)

Now you're logged in to Fly.io dashboard.

---

## Step 3: Login to Fly.io CLI

Open terminal and authenticate with Fly.io:

```bash
flyctl auth login
```

This will:
1. Open a browser window
2. Ask you to authorize the CLI
3. Create an authentication token on your computer

If you're not prompted to open a browser, follow the URL shown in terminal.

Verify login:
```bash
flyctl auth whoami
# Should show your Fly.io username
```

---

## Step 4: Clone ProteaAI Repository

```bash
# Clone the repository
git clone https://github.com/KHAYAAI/PROTEAAI.git
cd PROTEAAI

# (Or, if you have a fork)
git clone https://github.com/YOUR-USERNAME/PROTEAAI.git
cd PROTEAAI
```

---

## Step 5: Build Docker Image

The ProteaAI repository includes a `Dockerfile` that builds the application.

Build the image:

```bash
docker build -t proteaai:latest .
```

This will:
- Download Node.js 24 base image
- Install dependencies (`npm install`)
- Build the React web client
- Build the Node.js server
- Create a final optimized image (~400MB)

**This takes 5-10 minutes on first build.**

After building, verify:
```bash
docker images | grep proteaai
# Should show: proteaai | latest | <size>
```

---

## Step 6: Create Fly.io App

Create a new Fly.io app:

```bash
cd PROTEAAI
flyctl launch --no-deploy
```

This will:
1. Ask for an app name (e.g., `proteaai-prod`, `myapp-ai`)
2. Ask for a region (default: `iad` = US East, good for most)
3. Ask about adding a database (say **No** — we'll use EFS volume)
4. Create `fly.toml` configuration file

**Choose a unique app name** — Fly.io requires globally unique names.

Example names (pick one that's available):
- `proteaai-prod`
- `mycompany-proteaai`
- `ai-builder-app`

Verify `fly.toml` was created:
```bash
cat fly.toml
# Should show app configuration
```

---

## Step 7: Create Persistent Volume (for SQLite database)

ProteaAI needs a persistent volume to store the SQLite database:

```bash
flyctl volumes create proteaai_data --size 10
```

This creates a 10GB volume (adjust size if needed later).

Verify:
```bash
flyctl volumes list
# Should show: proteaai_data | 10GB
```

---

## Step 8: Set Environment Secrets

Now set all required secrets in Fly.io:

```bash
# Set JWT_SECRET (replace with your generated value from Step 1)
flyctl secrets set JWT_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f"

# Set SECRET_KEY (replace with your generated value from Step 1)
flyctl secrets set SECRET_KEY="x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4z3y2x1w0v"

# Set NODE_ENV to production
flyctl secrets set NODE_ENV="production"

# Set your domain (or Fly.io will assign one)
# Replace "yourdomain.com" with your actual domain
flyctl secrets set CORS_ORIGIN="https://yourdomain.com"
flyctl secrets set APP_BASE_URL="https://yourdomain.com"

# Optional: Stripe (only if you have Stripe account)
# flyctl secrets set STRIPE_SECRET_KEY="sk_live_..."
# flyctl secrets set STRIPE_WEBHOOK_SECRET="whsec_..."
# flyctl secrets set STRIPE_PRO_PRICE_ID="price_..."

# Optional: PayFast (South African payments)
# flyctl secrets set PAYFAST_MERCHANT_ID="..."
# flyctl secrets set PAYFAST_MERCHANT_KEY="..."
# flyctl secrets set PAYFAST_PASSPHRASE="..."
# flyctl secrets set PAYFAST_SANDBOX="false"
# flyctl secrets set PAYFAST_PRO_AMOUNT="149.00"
```

Verify secrets are set:
```bash
flyctl secrets list
# Should show: JWT_SECRET, SECRET_KEY, NODE_ENV, CORS_ORIGIN, APP_BASE_URL
```

---

## Step 9: Deploy to Fly.io

Deploy your app:

```bash
flyctl deploy
```

This will:
1. Build the Docker image
2. Upload to Fly.io registry
3. Start 1 instance (Fargate VM)
4. Run migrations automatically
5. Check health

**First deploy takes 3-5 minutes.**

Watch the deployment:
```bash
flyctl logs --follow
```

Press `Ctrl+C` to stop watching logs.

---

## Step 10: Get Your App URL

After deployment, get your app's URL:

```bash
flyctl open
# Opens your app in browser

# Or get the URL without opening:
flyctl info
# Look for "Hostname:" field
```

Your app will be at: `https://your-app-name.fly.dev`

Test it:
```bash
curl https://your-app-name.fly.dev/health
# Should return: { "ok": true, "version": "..." }
```

---

## Step 11: Verify Everything Works

### Test Health Endpoint
```bash
curl https://your-app-name.fly.dev/health
```

Expected response:
```json
{ "ok": true, "version": "1.0.0" }
```

### Test Web App in Browser

1. Open https://your-app-name.fly.dev
2. You should see the login page
3. Try signing up with an email

### Check Logs for Errors

```bash
flyctl logs
# Should show startup messages without errors
```

### Verify Database Created

```bash
# SSH into the app and check database
flyctl ssh console

# Inside the console:
sqlite3 /data/sqlite.db ".tables"
# Should show all database tables

exit
```

---

## Step 12: Setup Custom Domain (Optional)

If you have your own domain:

### 1. Create SSL Certificate

```bash
flyctl certs add yourdomain.com
```

### 2. Update Your DNS Provider

Go to your domain registrar (GoDaddy, Namecheap, Route53, etc.):

1. Find the DNS settings
2. Add a CNAME record:
   - **Name:** `yourdomain.com` (or just leave blank)
   - **Value:** `your-app-name.fly.dev`

3. Add another CNAME for www (optional):
   - **Name:** `www`
   - **Value:** `your-app-name.fly.dev`

### 3. Verify Certificate

```bash
flyctl certs show yourdomain.com
# Should show: "Certificate issue complete!"
```

This takes 5-15 minutes for DNS to propagate.

### 4. Update Fly.io Secrets

```bash
flyctl secrets set CORS_ORIGIN="https://yourdomain.com"
flyctl secrets set APP_BASE_URL="https://yourdomain.com"

# Redeploy
flyctl deploy
```

---

## Step 13: Scale Up (Optional)

If you need more resources:

### View Current Status
```bash
flyctl status
# Shows current resource allocation
```

### Change VM Size

```bash
# Scale up CPU/memory
flyctl scale vm shared-cpu-1x  # 1 shared CPU, 256MB RAM (default)
flyctl scale vm shared-cpu-2x  # 2 shared CPUs, 1GB RAM
flyctl scale vm performance-1x # 1 dedicated CPU, 2GB RAM
```

### Scale Instances

```bash
# Run 2 instances for redundancy
flyctl scale count 2

# Back to 1
flyctl scale count 1
```

---

## Step 14: View Logs and Monitor

### Watch Live Logs
```bash
flyctl logs --follow
```

### View Logs from Last Hour
```bash
flyctl logs --tail 100
```

### Filter for Errors
```bash
flyctl logs --grep "ERROR"
```

---

## Troubleshooting

### Issue: App keeps restarting

**Symptoms:** Logs show app crashing repeatedly

**Solution:**
1. Check if secrets are set:
   ```bash
   flyctl secrets list
   ```

2. Verify JWT_SECRET and SECRET_KEY are exactly 64 hex characters
3. Check for errors:
   ```bash
   flyctl logs --tail 50
   ```

4. Common errors:
   - `JWT_SECRET not set` → Run `flyctl secrets set JWT_SECRET="..."`
   - `Cannot find migrations` → Redeploy: `flyctl deploy`

### Issue: Can't access the app

**Symptoms:** Timeout when visiting the URL

**Solution:**
1. Check if app is running:
   ```bash
   flyctl status
   ```

2. Check health endpoint:
   ```bash
   curl https://your-app-name.fly.dev/health -v
   ```

3. Check logs:
   ```bash
   flyctl logs
   ```

### Issue: Database not found

**Symptoms:** Error about `/data/sqlite.db` not existing

**Solution:**
1. Verify volume is attached:
   ```bash
   flyctl volumes list
   ```

2. If missing, create it:
   ```bash
   flyctl volumes create proteaai_data --size 10
   ```

3. Redeploy:
   ```bash
   flyctl deploy
   ```

### Issue: Disk running out of space

**Symptoms:** Error: "ENOSPC" (no space)

**Solution:**
1. Check volume size:
   ```bash
   flyctl volumes list
   ```

2. Create new volume and migrate data (advanced):
   - Contact Fly.io support or use `flyctl volumes extend`

### Issue: Custom domain not working

**Symptoms:** Certificate shows "pending"

**Solution:**
1. Verify DNS is updated:
   ```bash
   dig yourdomain.com
   # Should show Fly.io's IP
   ```

2. Wait for DNS propagation (can take 24 hours)
3. Check certificate status:
   ```bash
   flyctl certs show yourdomain.com
   ```

---

## Backup & Recovery

### Backup Database

```bash
# SSH into app
flyctl ssh console

# Inside console, backup database:
sqlite3 /data/sqlite.db ".backup /data/backup.db"
exit

# Copy backup to local machine:
flyctl sftp get /data/backup.db
```

### Restore Database

```bash
# Upload backup:
flyctl sftp put backup.db /data/

# SSH in and restore:
flyctl ssh console

# Inside console:
sqlite3 /data/sqlite.db ".restore /data/backup.db"
exit
```

---

## Monthly Costs

| Component | Cost | Notes |
|-----------|------|-------|
| Shared-cpu-1x VM | $2.70 | 1 shared CPU, 256MB RAM |
| Volume storage | $0.15/GB | 10GB = $1.50 |
| Bandwidth | Included first 100GB | Then $0.02/GB |
| **Total** | **~$5-10/month** | For <5K users |

---

## Next Steps

1. **Test the app**: Sign up, create an app, run a chat
2. **Setup Stripe** (optional): For paid subscriptions
3. **Setup backups**: Regular database backups
4. **Monitor logs**: Check `flyctl logs` periodically
5. **Scaling**: When you hit 5K users, consider migrating to PostgreSQL

---

## Support

- **Fly.io Docs:** https://fly.io/docs/
- **ProteaAI Issues:** https://github.com/KHAYAAI/PROTEAAI/issues
- **Fly.io Community:** https://community.fly.io

---

## Cheat Sheet

```bash
# Common commands
flyctl launch --no-deploy          # Create new app
flyctl volumes create proteaai_data --size 10  # Create volume
flyctl secrets set KEY="value"     # Set secret
flyctl deploy                      # Deploy app
flyctl logs --follow               # Watch logs
flyctl ssh console                 # SSH into app
flyctl open                        # Open app in browser
flyctl info                        # Show app info
flyctl status                      # Show status
flyctl scale count 2               # Run 2 instances
flyctl destroy                     # Delete app
```

---

**Congratulations!** Your ProteaAI app is now live on Fly.io! 🎉
