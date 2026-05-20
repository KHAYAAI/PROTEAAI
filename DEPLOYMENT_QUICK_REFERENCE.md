# ProteaAI Deployment Quick Reference

**Save this file for quick lookup during deployment!**

---

## 🔑 Secret Generation

Generate these BEFORE deployment:

```bash
# Generate JWT_SECRET (copy the output)
openssl rand -hex 32

# Generate SECRET_KEY (copy the output)
openssl rand -hex 32
```

**Example output:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f
```

**Keep these safe!** You'll need them for deployment.

---

## 🚀 Fly.io Deployment Checklist

### Prerequisites
- [ ] Git installed: `git --version`
- [ ] Node.js v24: `node --version`
- [ ] Docker installed: `docker --version`
- [ ] flyctl installed: `flyctl version`

### Quick Deploy

```bash
# 1. Login
flyctl auth login

# 2. Clone repo
git clone https://github.com/KHAYAAI/PROTEAAI.git
cd PROTEAAI

# 3. Create app (choose unique name)
flyctl launch --no-deploy

# 4. Create volume
flyctl volumes create proteaai_data --size 10

# 5. Set secrets (replace with YOUR values)
flyctl secrets set JWT_SECRET="your-64-char-hex-string"
flyctl secrets set SECRET_KEY="your-64-char-hex-string"
flyctl secrets set NODE_ENV="production"
flyctl secrets set CORS_ORIGIN="https://yourdomain.com"
flyctl secrets set APP_BASE_URL="https://yourdomain.com"

# 6. Deploy
flyctl deploy

# 7. Get URL
flyctl open

# 8. Test
curl https://your-app.fly.dev/health
```

### Useful Commands

```bash
flyctl logs --follow          # Watch logs
flyctl ssh console            # SSH into app
flyctl status                 # Check status
flyctl open                   # Open in browser
flyctl scale count 2          # Run 2 instances
flyctl secrets list           # List all secrets
flyctl destroy                # Delete app
```

**Time:** 30 minutes
**Cost:** $5-20/month

---

## 🚀 Vercel Deployment Checklist

### Prerequisites
- [ ] Git installed: `git --version`
- [ ] Node.js v24: `node --version`
- [ ] GitHub account created
- [ ] Neon account created: https://neon.tech

### Quick Deploy

```bash
# 1. Create Neon PostgreSQL
# Go to https://neon.tech → Sign up with GitHub
# Copy your connection string (postgresql://...)

# 2. Go to Vercel
# https://vercel.com/new

# 3. Import your GitHub repo
# Choose PROTEAAI → Click Import

# 4. Add environment variables in Vercel Dashboard:
JWT_SECRET=your-64-char-hex
SECRET_KEY=your-64-char-hex
DATABASE_URL=postgresql://... (from Neon)
NODE_ENV=production
CORS_ORIGIN=https://your-app.vercel.app
APP_BASE_URL=https://your-app.vercel.app

# 5. Click Deploy

# 6. Test
curl https://your-app.vercel.app/health

# 7. Verify migrations ran
# Go to Neon Console → Tables (should see users, apps, chats, etc.)
```

### Useful Commands

```bash
vercel logs                   # View logs
vercel logs --follow          # Watch logs
vercel env list              # List environment variables
vercel rollback              # Rollback to previous
vercel remove                # Delete project
```

**Time:** 45 minutes
**Cost:** Free-$50/month (starts free)

---

## 📋 Environment Variables

### Required (All Platforms)

| Variable | Value | Example |
|----------|-------|---------|
| `JWT_SECRET` | 64-char hex | `a1b2c3d4e5f6...` |
| `SECRET_KEY` | 64-char hex | `x9y8z7w6v5u4...` |
| `NODE_ENV` | `production` | `production` |
| `CORS_ORIGIN` | Your domain | `https://yourdomain.com` |
| `APP_BASE_URL` | Your domain | `https://yourdomain.com` |

### Optional (Stripe Payments)

| Variable | Value | Get From |
|----------|-------|----------|
| `STRIPE_SECRET_KEY` | Secret key | Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | Webhook secret | Stripe Dashboard |
| `STRIPE_PRO_PRICE_ID` | Price ID | Stripe Dashboard |

### Vercel Only

| Variable | Value | Get From |
|----------|-------|----------|
| `DATABASE_URL` | Connection string | Neon Console |

### Fly.io Only

| Variable | Value | Notes |
|----------|-------|-------|
| Volume | `proteaai_data` | SQLite database storage |

---

## ✅ Verification Tests

### Health Endpoint

```bash
curl https://your-app.com/health

# Expected response:
# { "ok": true, "version": "1.0.0" }
```

### Signup Test

1. Open https://your-app.com
2. Click "Sign Up"
3. Enter:
   - Email: test@example.com
   - Password: TestPassword123!
   - Name: Test User
4. Click "Sign Up"
5. Should see dashboard

### API Test

```bash
# 1. Get token from signup
# 2. Then test /auth/me

curl https://your-app.com/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: { "ok": true, "data": { "email": "...", "plan": "free" } }
```

---

## 🐛 Quick Troubleshooting

### App Won't Start
```bash
# Check secrets are set
flyctl secrets list  (Fly.io)
vercel env list      (Vercel)

# Check logs
flyctl logs          (Fly.io)
vercel logs          (Vercel)

# Common error: JWT_SECRET not set
# Solution: Add the secret again
```

### Database Error
```bash
# Fly.io: Check volume exists
flyctl volumes list

# Vercel: Check Neon database running
# Go to Neon Console → Project Status should be green
```

### Domain Not Working
```bash
# Check DNS propagation (takes 5-30 minutes)
dig yourdomain.com

# Verify SSL certificate
# Fly.io: flyctl certs show yourdomain.com
# Vercel: Check dashboard → Domains
```

### Performance Issues
```bash
# Check logs for errors
flyctl logs --grep "ERROR"  (Fly.io)
vercel logs --grep "ERROR"  (Vercel)

# Scale up if needed
flyctl scale vm shared-cpu-2x  (Fly.io)
# Vercel: Upgrade to Pro in dashboard
```

---

## 📊 Cost Comparison

### For 5K Users

**Fly.io:**
- VM: $2.70/month
- Volume: $1.50/month
- Bandwidth: Free (100GB included)
- **Total: ~$5-10/month**

**Vercel:**
- Compute: Free tier (usually sufficient)
- Database (Neon): Free tier (3GB)
- Bandwidth: Free (100GB included)
- **Total: $0-20/month** (free tier works)

### For 50K Users

**Fly.io:**
- Larger VM: $30-50/month
- Volume: $5-10/month
- **Total: ~$40-60/month**

**Vercel:**
- Pro compute: $20/month
- Database tier: $50/month
- **Total: $70-100/month**

---

## 🎯 Decision Matrix

### Choose Fly.io If:
- ✓ You want simplicity (30 min setup)
- ✓ You expect consistent traffic
- ✓ You want lowest cost
- ✓ You want always-fast responses
- ✓ You're new to deployment

### Choose Vercel If:
- ✓ You use GitHub heavily
- ✓ You want auto-deployments
- ✓ You expect variable traffic
- ✓ You need PostgreSQL features
- ✓ You're already on Vercel

---

## 📚 Quick Links

**Getting Help:**
- Fly.io Docs: https://fly.io/docs/
- Vercel Docs: https://vercel.com/docs
- ProteaAI Issues: https://github.com/KHAYAAI/PROTEAAI/issues

**Generate Secrets:**
- OpenSSL: `openssl rand -hex 32`
- Node.js: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**Check Prerequisites:**
```bash
git --version          # Git
node --version         # Node.js (should be v24.x)
docker --version       # Docker
flyctl version         # Fly.io CLI (if using Fly.io)
```

---

## 📝 Pre-Deployment Checklist

- [ ] Generated JWT_SECRET (64 hex chars)
- [ ] Generated SECRET_KEY (64 hex chars)
- [ ] Chose platform (Fly.io or Vercel)
- [ ] Created account on chosen platform
- [ ] Cloned GitHub repo
- [ ] Have 30-45 minutes available
- [ ] Domain name (optional)
- [ ] Stripe account (optional, for payments)

---

## 🚀 Deployment Steps Summary

### Fly.io (30 minutes)
1. Login with `flyctl auth login`
2. Run `flyctl launch --no-deploy`
3. Create volume with `flyctl volumes create proteaai_data --size 10`
4. Set secrets with `flyctl secrets set`
5. Deploy with `flyctl deploy`
6. Test with `curl https://your-app.fly.dev/health`

### Vercel (45 minutes)
1. Create Neon PostgreSQL database
2. Copy DATABASE_URL from Neon
3. Go to vercel.com/new
4. Import GitHub repo
5. Add environment variables
6. Click Deploy
7. Test with `curl https://your-app.vercel.app/health`

---

## 💡 Pro Tips

1. **Save secrets to a file** (don't commit to git):
   ```
   JWT_SECRET=...
   SECRET_KEY=...
   DATABASE_URL=...
   ```

2. **Test locally first:**
   ```bash
   npm run dev
   # Visit http://localhost:3001
   # Test signup, login, create app
   ```

3. **Start with free tier** and upgrade later

4. **Monitor logs regularly** for errors:
   ```bash
   flyctl logs --follow  (Fly.io)
   vercel logs           (Vercel)
   ```

5. **Backup database before major changes:**
   ```bash
   # Fly.io SQLite
   flyctl ssh console
   sqlite3 /data/sqlite.db ".backup /data/backup.db"
   
   # Vercel PostgreSQL
   pg_dump "$DATABASE_URL" > backup.sql
   ```

---

## 🎓 Complete Learning Path

1. **Read** DEPLOYMENT_README.md (5 min)
2. **Choose** LAUNCH_GUIDE_QUICK_START.md (10 min)
3. **Deploy** LAUNCH_GUIDE_FLY_IO.md or LAUNCH_GUIDE_VERCEL.md (30-45 min)
4. **Verify** & test everything (5-10 min)
5. **Celebrate** 🎉

**Total time: 60-90 minutes**

---

## ❓ Common Questions

**Q: Which platform should I choose?**
A: Fly.io for beginners (simpler), Vercel for GitHub workflows

**Q: Can I switch later?**
A: Yes! Code runs on both. Just deploy to new platform and update DNS.

**Q: How much will it cost?**
A: Fly.io $5-20/month, Vercel free tier (usually sufficient)

**Q: What if I need help?**
A: Check the full guide's TROUBLESHOOTING section (10-15+ solutions)

**Q: Can I use custom domain immediately?**
A: Yes, but you can test with free domain first (fly.dev or vercel.app)

**Q: Do I need Stripe for launching?**
A: No, it's optional. All users start with free plan.

---

**Good luck with your deployment! 🚀**

For full details, read: DEPLOYMENT_README.md
