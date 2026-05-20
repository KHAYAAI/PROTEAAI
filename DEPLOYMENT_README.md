# ProteaAI Deployment Guide

Complete guides for deploying ProteaAI to production on Fly.io or Vercel.

---

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Deployment Options](#deployment-options)
- [Before You Deploy](#before-you-deploy)
- [Guides](#guides)
- [Troubleshooting](#troubleshooting)
- [Post-Deployment](#post-deployment)

---

## 🚀 Quick Start

### For Beginners:

1. **First, read:** [Quick Comparison Guide](./LAUNCH_GUIDE_QUICK_START.md)
   - Choose between Fly.io and Vercel
   - Understand the differences
   - Pick what's best for you

2. **Then, follow the full guide:**
   - **Fly.io?** → [Fly.io Launch Guide](./LAUNCH_GUIDE_FLY_IO.md)
   - **Vercel?** → [Vercel Launch Guide](./LAUNCH_GUIDE_VERCEL.md)

3. **Time estimate:**
   - Fly.io: 30-45 minutes
   - Vercel: 45-60 minutes

---

## 🌐 Deployment Options

ProteaAI supports **three production platforms:**

### 1. Fly.io (Recommended for beginners)

- **Type:** Virtual Machine (always-on)
- **Database:** SQLite (file-based)
- **Cost:** $5-20/month
- **Setup time:** 30 minutes
- **Best for:** Simple deployments, consistent traffic
- **Pros:**
  - Simple setup with `flyctl`
  - Always-fast responses (no cold starts)
  - Lowest cost
  - Great documentation
- **Cons:**
  - Database limited to SQLite (for <50K users)
  - Less auto-scaling
  
**[Full Fly.io Guide →](./LAUNCH_GUIDE_FLY_IO.md)**

---

### 2. Vercel (Best for GitHub workflows)

- **Type:** Serverless Functions
- **Database:** PostgreSQL via Neon
- **Cost:** Free-$50/month
- **Setup time:** 45 minutes
- **Best for:** Automatic deployments, variable traffic
- **Pros:**
  - Automatic deployments on GitHub push
  - Scales automatically
  - Enterprise PostgreSQL database
  - Preview deployments for PRs
- **Cons:**
  - Cold starts (5-10 seconds first request)
  - Slightly more complex setup

**[Full Vercel Guide →](./LAUNCH_GUIDE_VERCEL.md)**

---

### 3. AWS (Advanced users)

- **Type:** ECS Fargate + ALB
- **Database:** RDS PostgreSQL or EFS SQLite
- **Cost:** $50-200/month
- **Setup time:** 2-4 hours
- **Best for:** Enterprise deployments, compliance needs
- **Note:** Requires Terraform knowledge

**[AWS Terraform Infrastructure →](./terraform/README.md)**

---

## ✅ Before You Deploy

### Prerequisites

You'll need:

- [ ] **Git** installed
- [ ] **Node.js v24** installed
- [ ] **Docker** installed (for building)
- [ ] **GitHub account** (for version control)
- [ ] **Fly.io or Vercel account** (create free)
- [ ] **Domain name** (optional, can use free domain)

### Generate Secrets

**IMPORTANT:** Create two random 64-character hex strings:

```bash
# Generate JWT_SECRET
openssl rand -hex 32
# Copy the output

# Generate SECRET_KEY
openssl rand -hex 32
# Copy the output
```

Keep these safe! You'll need them during deployment.

### Clone Repository

```bash
git clone https://github.com/KHAYAAI/PROTEAAI.git
cd PROTEAAI
```

---

## 📖 Guides

### Fly.io (30-45 minutes)

Follow this step-by-step guide:

1. Generate secrets
2. Create Fly.io account & login
3. Build Docker image
4. Deploy to Fly.io
5. Set environment secrets
6. Verify deployment

**[→ Complete Fly.io Guide](./LAUNCH_GUIDE_FLY_IO.md)**

---

### Vercel (45-60 minutes)

Follow this step-by-step guide:

1. Generate secrets
2. Create Neon PostgreSQL database
3. Create Vercel account
4. Connect GitHub repository
5. Add environment variables
6. Deploy
7. Verify & run migrations

**[→ Complete Vercel Guide](./LAUNCH_GUIDE_VERCEL.md)**

---

### Quick Comparison

Not sure which platform? Read this first:

**[→ Quick Comparison Guide](./LAUNCH_GUIDE_QUICK_START.md)**

Covers:
- Feature comparison
- Cost breakdown
- Setup complexity
- Performance differences
- Decision guide

---

## 🔐 Secrets Management

### What Secrets Do I Need?

| Secret | Purpose | How to Generate |
|--------|---------|-----------------|
| `JWT_SECRET` | Sign authentication tokens | `openssl rand -hex 32` |
| `SECRET_KEY` | Encrypt user settings | `openssl rand -hex 32` |
| `NODE_ENV` | Set to `production` | Type: `production` |
| `CORS_ORIGIN` | Your domain | Type: `https://yourdomain.com` |
| `APP_BASE_URL` | Your domain | Type: `https://yourdomain.com` |

### Optional Secrets

| Secret | For | How to Get |
|--------|-----|-----------|
| `STRIPE_SECRET_KEY` | Payments | Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | Payment webhooks | Stripe dashboard |
| `STRIPE_PRO_PRICE_ID` | Pro plan pricing | Stripe dashboard |

### Security Best Practices

- ✅ **DO** use unique random secrets
- ✅ **DO** store secrets in platform's secret manager (Fly.io/Vercel)
- ✅ **DO** rotate secrets periodically
- ❌ **DON'T** commit secrets to Git
- ❌ **DON'T** share secrets in messages or screenshots
- ❌ **DON'T** reuse the same secret across platforms

---

## 🧪 Verify Deployment

After deploying, test your app:

### 1. Check Health Endpoint

```bash
curl https://your-app-name.com/health
# Expected: { "ok": true, "version": "..." }
```

### 2. Test Web App

1. Open https://your-app-name.com
2. Sign up with an email
3. Create a test app
4. Start a chat

### 3. Check Logs

**Fly.io:**
```bash
flyctl logs
```

**Vercel:**
```bash
vercel logs
```

---

## 🐛 Troubleshooting

### Common Issues

**App won't start:**
- Check secrets are set: `JWT_SECRET`, `SECRET_KEY`
- Check NODE_ENV is `production`
- View logs for detailed error

**Database error:**
- Verify database URL (DATABASE_URL for Vercel)
- Check migrations ran successfully
- For Fly.io: verify volume is mounted

**Domain not working:**
- DNS can take 5-30 minutes to propagate
- Verify you added correct DNS records
- Check SSL certificate is issued

**Performance issues:**
- Fly.io: Increase VM size
- Vercel: Upgrade to Pro for faster CPUs

**For detailed troubleshooting:**
- See Fly.io Guide → [Troubleshooting](./LAUNCH_GUIDE_FLY_IO.md#troubleshooting)
- See Vercel Guide → [Troubleshooting](./LAUNCH_GUIDE_VERCEL.md#troubleshooting)

---

## 📊 Post-Deployment

### First Week

- [ ] Test all features (signup, login, chat, settings)
- [ ] Monitor logs for errors
- [ ] Check database growth
- [ ] Verify email (if configured)
- [ ] Test Stripe (if configured)

### Monthly Tasks

- [ ] Check logs for errors
- [ ] Monitor costs
- [ ] Back up database
- [ ] Check for security updates
- [ ] Rotate secrets (optional but recommended)

### Scaling

| Users | Action |
|-------|--------|
| 1-5K | Current setup sufficient |
| 5-50K | Increase VM size or Vercel Pro |
| 50K-100K | Migrate to PostgreSQL (Fly.io) or increase DB tier |
| 100K+ | Consider multi-region deployment |

---

## 📚 Additional Resources

### Official Documentation

- [Fly.io Docs](https://fly.io/docs/)
- [Vercel Docs](https://vercel.com/docs)
- [ProteaAI GitHub](https://github.com/KHAYAAI/PROTEAAI)

### Tutorials

- [Fly.io Getting Started](https://fly.io/docs/getting-started/)
- [Vercel Quickstart](https://vercel.com/docs/concepts/get-started/quickstart)
- [PostgreSQL Basics](https://www.postgresql.org/docs/)

### Community

- [Fly.io Community](https://community.fly.io)
- [Vercel GitHub Discussions](https://github.com/vercel/vercel/discussions)
- [ProteaAI GitHub Issues](https://github.com/KHAYAAI/PROTEAAI/issues)

---

## 💡 Tips for Success

### 1. Start Simple

- Use Fly.io for your first deployment
- Get familiar with the basics
- Migrate to Vercel/AWS later if needed

### 2. Test Locally First

```bash
# Run locally before deploying
npm run dev

# Visit http://localhost:3001
# Test signup, login, create app, chat
```

### 3. Use Version Control

```bash
# Commit your setup scripts
git add .
git commit -m "Add deployment configuration"
git push
```

### 4. Monitor From Day One

- Check logs regularly
- Set up alerts
- Watch for errors

### 5. Document Your Setup

- Save your configuration
- Document custom changes
- Keep deployment notes

---

## 🎯 Next Steps

1. **Choose your platform:** [Quick Comparison](./LAUNCH_GUIDE_QUICK_START.md)
2. **Follow the guide:**
   - [Fly.io](./LAUNCH_GUIDE_FLY_IO.md) or
   - [Vercel](./LAUNCH_GUIDE_VERCEL.md)
3. **Deploy your app** (30-45 minutes)
4. **Test everything works**
5. **Share with users!**

---

## ❓ FAQ

### Q: Which platform should I choose?

**A:** If you're new to deployment, start with **Fly.io**. It's simpler and has no cold starts. If you use GitHub extensively, choose **Vercel** for automatic deployments.

---

### Q: Can I switch platforms later?

**A:** Yes! The code runs on both. To switch:
1. Deploy to new platform
2. Export data from old platform
3. Import data to new platform
4. Update DNS to point to new platform

---

### Q: How much will it cost?

**A:** 
- Fly.io: $5-20/month for <50K users
- Vercel: Free tier works for <50K users
- Both much cheaper than AWS

---

### Q: What if I need more help?

**A:** 
- Read the full guide (Fly.io or Vercel)
- Check the troubleshooting section
- Contact platform support
- Open an issue on GitHub

---

### Q: Can I use both platforms?

**A:** Yes! You can deploy to both for redundancy/testing. Use DNS to route traffic to primary platform.

---

## 📝 Deployment Checklist

Before deploying, verify you have:

```
[ ] Secrets generated (JWT_SECRET, SECRET_KEY)
[ ] Fly.io or Vercel account created
[ ] GitHub repository cloned
[ ] Domain name (optional)
[ ] 30-45 minutes of time
[ ] A quiet place to focus

Ready to deploy? Start here:
[ ] Read Quick Comparison (5 min)
[ ] Follow full guide (30-45 min)
[ ] Test deployment (5 min)
[ ] Celebrate! 🎉
```

---

## Support

**Need help?** Check these in order:

1. **Read the full guide** (Fly.io or Vercel)
2. **Check Troubleshooting section** of that guide
3. **Search GitHub issues** for your problem
4. **Contact platform support**
5. **Open a GitHub issue** in ProteaAI repo

---

**Choose your platform and get started:**

- **→ [Fly.io Guide](./LAUNCH_GUIDE_FLY_IO.md)** (Recommended for beginners)
- **→ [Vercel Guide](./LAUNCH_GUIDE_VERCEL.md)** (For GitHub workflows)
- **→ [Quick Comparison](./LAUNCH_GUIDE_QUICK_START.md)** (Help choosing)

---

Happy deploying! 🚀
