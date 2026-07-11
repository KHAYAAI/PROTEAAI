# ProteaAI — AWS Launch Plan & Deployment Timeline

**Document version:** 1.0
**Date:** 11 July 2026
**Owner:** ProteaAI Engineering / DevOps
**DevOps capacity assumption:** 5–7 hours per week (single engineer, part-time)
**Target production launch:** **Thursday, 15 October 2026**
**Total estimated effort:** 78–96 DevOps hours over 14 weeks

---

## 1. Executive Summary

ProteaAI is a dual-mode AI application builder (desktop app + web SaaS). This document is the single source of truth for taking the **web SaaS platform live on AWS**, connecting it to the **marketing site** (currently https://proteaai.base44.app, custom domain pending), and completing everything else required for a credible, industry-leading public launch: CI/CD, security hardening, monitoring, billing, legal pages, analytics, support channels, and a launch-day runbook.

The plan is deliberately paced for a DevOps engineer with **5–7 hours per week**. Every phase lists its estimated hours, its calendar window, concrete tasks, and a hard "definition of done" so progress is measurable week by week. Slack is built in: the critical path totals ~78 hours against a ~98-hour capacity budget, leaving roughly 20% contingency for surprises.

### What already exists (built and committed)

| Asset | Status |
|---|---|
| Terraform infrastructure (8 modules: networking, ECR, secrets, database, IAM, CloudWatch, ALB, ECS) | ✅ Complete |
| Terraform remote state bootstrap script (S3 + DynamoDB) | ✅ Complete |
| Dockerfile + docker-compose for the web server | ✅ Complete |
| JWT auth with server-side token revocation (SQLite & PostgreSQL) | ✅ Complete |
| Dual database support (SQLite-on-EFS or RDS PostgreSQL, selected by `database_type`) | ✅ Complete |
| Stripe + PayFast billing integration | ✅ Complete |
| GDPR export/deletion endpoints | ✅ Complete |
| E2E test suites (auth, billing, apps) | ✅ Complete |
| Health check endpoint (`/health`) | ✅ Complete |

### What this plan delivers

1. A production AWS environment (ECS Fargate behind an ALB, RDS PostgreSQL, Secrets Manager, CloudWatch) provisioned entirely from the existing Terraform.
2. A staging environment that mirrors production.
3. A CI/CD pipeline: push to `main` → build → test → deploy to staging → manual promote to production.
4. DNS and domain architecture connecting the marketing site and the app under one brand domain.
5. Security hardening (WAF, rate limiting, backup verification, secret rotation).
6. Observability (dashboards, alarms, log retention, uptime monitoring, status page).
7. Launch collateral: legal pages, analytics, support inbox, onboarding email, incident runbook.
8. A post-launch growth and reliability roadmap.

---

## 2. Project Goals

### 2.1 Business goals

| # | Goal | Measure | Target date |
|---|---|---|---|
| G1 | Public production launch on AWS | app.proteaai.* live, signups open | 15 Oct 2026 |
| G2 | Marketing site → app conversion funnel live | CTA click-through tracked end-to-end | 15 Oct 2026 |
| G3 | Paid subscriptions operational | First real Stripe/PayFast payment processed | 31 Oct 2026 |
| G4 | 500 registered users | Registered accounts | 31 Dec 2026 |
| G5 | 5% free→paid conversion | Paying users ÷ registered users | 31 Mar 2027 |

### 2.2 Engineering goals

| # | Goal | Measure |
|---|---|---|
| E1 | 99.9% uptime (≤ 43 min downtime/month) | ALB healthy-host + uptime monitor |
| E2 | p95 API latency < 500 ms (non-AI endpoints) | CloudWatch / ALB target response time |
| E3 | Deploy to production in < 15 minutes, zero downtime | Pipeline duration; rolling ECS deploys |
| E4 | Recovery Point Objective (RPO) ≤ 24 h, Recovery Time Objective (RTO) ≤ 4 h | Verified restore drill (Phase 4) |
| E5 | No plaintext secrets anywhere | All secrets in AWS Secrets Manager |
| E6 | Every production change goes through CI | Branch protection on `main` |

### 2.3 "Top of the industry" quality bar

These are the differentiators the launch must protect — they are why users would pick ProteaAI over incumbent AI app builders:

- **Dual-mode product**: same codebase runs as a local-first desktop app (privacy, no lock-in) and a zero-install web SaaS. Few competitors offer both.
- **Bring-your-own-key AND managed AI**: users can plug in their own provider keys or use platform-managed models.
- **Real code ownership**: generated apps are real repos the user can export — the marketing site must say this loudly.
- **South African + global payments**: PayFast alongside Stripe opens a market most competitors ignore.
- **Transparent diff/approval workflow**: users approve every file change; this is the trust story.

---

## 3. Target Architecture (recap)

```
                        ┌──────────────────────────────┐
  proteaai.com  ───────▶│  Marketing site (Base44)      │
  www.proteaai.com      │  https://proteaai.base44.app  │
                        └──────────────┬───────────────┘
                                       │  "Launch App" / "Sign Up" CTAs
                                       ▼
  app.proteaai.com ──▶ Route 53 ──▶ ALB (HTTPS, ACM cert)
                                      │
                          ┌───────────┴───────────┐
                          │  ECS Fargate service  │  (2× tasks, auto-scaling 2–10)
                          │  ProteaAI web server  │  ports 3000/3001
                          └───────────┬───────────┘
                    ┌─────────────────┼──────────────────┐
                    ▼                 ▼                  ▼
             RDS PostgreSQL     Secrets Manager     CloudWatch
             (or SQLite/EFS)    (JWT, Stripe,       (logs, alarms,
             private subnets     PayFast, keys)      dashboards)
```

- **Region:** `af-south-1` (Cape Town) if latency to the SA market is priority, otherwise `eu-west-1` (Ireland) for lowest cost and fullest service availability. **Decision required in Phase 0.** The Terraform takes this as a single variable.
- **Database:** RDS PostgreSQL (`database_type = "rds"`) is the production recommendation — multi-task safe, managed backups, point-in-time recovery. SQLite-on-EFS remains supported for a cheaper single-task setup.
- **Images:** built locally or in CI, pushed to ECR (lifecycle policy keeps last 10).
- **State:** Terraform state in S3 with DynamoDB locking (bootstrap script already in `terraform/`).

---

## 4. Domain & DNS Architecture

The marketing site currently lives at **https://proteaai.base44.app**. The domain may change; this plan assumes a custom apex domain (referred to as `proteaai.com` — substitute the final name everywhere).

| Hostname | Points to | Purpose |
|---|---|---|
| `proteaai.com` (apex) | Base44 (A/ALIAS per Base44 docs) | Marketing site |
| `www.proteaai.com` | CNAME → Base44 | Marketing site |
| `app.proteaai.com` | ALIAS → AWS ALB | **The platform** |
| `api.proteaai.com` | ALIAS → AWS ALB (optional, same target) | Future public API |
| `staging.proteaai.com` | ALIAS → staging ALB | Staging (behind basic auth or IP allowlist) |
| `status.proteaai.com` | CNAME → status page provider | Public status page |
| `mail` / SPF / DKIM / DMARC records | Amazon SES | Transactional email |

**Rules:**

1. Buy/transfer the domain into **Route 53** (or keep registrar and delegate NS to Route 53). One DNS control plane avoids the classic "marketing changed a record and broke the app" failure.
2. The ACM certificate is issued for `app.proteaai.com` (+ `api.`, `staging.` as SANs) via DNS validation in Route 53 — Terraform's `alb` module already consumes the certificate ARN.
3. Base44 keeps serving the marketing site; only its DNS records live in Route 53. If the marketing site later moves off Base44 (e.g. to S3+CloudFront on the same AWS account), only the apex/`www` records change — the app is untouched.
4. **HSTS** on `app.` after two weeks of stable HTTPS.

---

## 5. Timeline Overview

> Working assumption: 5–7 productive DevOps hours/week, weeks run Monday–Friday. Dates are 2026.

| Phase | Window | Weeks | Est. hours | Outcome |
|---|---|---|---|---|
| 0 — Foundations & accounts | Mon 13 Jul – Fri 24 Jul | 2 | 10–12 | AWS account production-ready, domain in Route 53, Terraform state bootstrapped |
| 1 — Core infrastructure | Mon 27 Jul – Fri 14 Aug | 3 | 15–18 | Full Terraform apply green: VPC, ALB+TLS, RDS, ECR, Secrets, CloudWatch |
| 2 — First deployment | Mon 17 Aug – Fri 28 Aug | 2 | 10–14 | App serving traffic at `app.` domain, health checks green, smoke tests pass |
| 3 — CI/CD & staging | Mon 31 Aug – Fri 11 Sep | 2 | 12–14 | Push-to-deploy pipeline; staging environment mirrors prod |
| 4 — Hardening & disaster drills | Mon 14 Sep – Fri 25 Sep | 2 | 12–14 | WAF, backups verified by restore, load test passed, alarm escalation live |
| 5 — Marketing integration & private beta | Mon 28 Sep – Fri 9 Oct | 2 | 10–12 | Funnel wired, analytics live, legal pages up, 20–50 beta users in |
| 6 — Launch week | Mon 12 Oct – Fri 16 Oct | 1 | 6–8 | **Public launch Thu 15 Oct** |
| 7 — Post-launch stabilization | Mon 19 Oct – Fri 13 Nov | 4 | 3–5/wk | Bug triage, scaling tune, first paid cohort |

**Critical path:** 0 → 1 → 2 → 3 → 6. Phases 4 and 5 have internal slack and can partially overlap 3 if ahead of schedule. If any phase slips a full week, launch moves to **Thu 22 Oct** — protect the launch date by cutting non-critical scope (see §13), not by skipping hardening.

---

## 6. Phase 0 — Foundations & Accounts (13–24 Jul, 10–12 h)

### Goals
A production-grade AWS account with guardrails, the domain under Route 53, and remote Terraform state — before a single resource is provisioned.

### Week 1 (13–17 Jul, ~6 h)

| Task | Est. | Detail |
|---|---|---|
| 0.1 AWS account & org hygiene | 1.5 h | Root account MFA; create `admin` and `terraform` IAM identities (no daily root use). Enable IAM Identity Center if multiple humans will touch AWS. |
| 0.2 Billing guardrails | 1 h | Budgets: alert at $100, $200, $400/mo. Enable Cost Explorer + cost allocation tags (`Project=proteaai`, `Environment`). |
| 0.3 Region decision | 0.5 h | `af-south-1` vs `eu-west-1` (see §3). Record decision + rationale in this doc. |
| 0.4 Security baseline | 1.5 h | Enable CloudTrail (all regions), GuardDuty, and default EBS/S3 encryption. Set account-level S3 public-access block. |
| 0.5 Terraform state backend | 1 h | Run `terraform/bootstrap-state-backend.sh`; confirm versioned, encrypted S3 bucket + DynamoDB lock table; add `backend "s3"` block and run `terraform init` successfully. |

### Week 2 (20–24 Jul, ~5 h)

| Task | Est. | Detail |
|---|---|---|
| 0.6 Domain purchase/transfer | 1.5 h | Register final domain (or transfer). Delegate DNS to Route 53 hosted zone. **This starts the DNS-propagation clock early — do not defer.** |
| 0.7 Point marketing records | 1 h | Recreate Base44's required records (apex/www) in Route 53 so https://proteaai.base44.app content serves from the custom domain. Verify with `dig` + browser. |
| 0.8 ACM certificate request | 0.5 h | Request cert for `app.` + `api.` + `staging.` with DNS validation; validation records into Route 53. (Cert must exist before Phase 1's ALB apply.) |
| 0.9 Secrets generation | 1 h | Generate production `JWT_SECRET` and `SECRET_KEY` (32+ bytes, `openssl rand -base64 48`); store in a password manager AND stage into `terraform.tfvars` (git-ignored). Collect Stripe **live** keys and PayFast production credentials. |
| 0.10 SES sandbox exit request | 0.5 h | Verify sending domain in SES, add DKIM records, request production access (approval takes days — start now). |

### Definition of done
- [ ] Root MFA on; no root access keys exist
- [ ] `terraform init` succeeds against the S3 backend
- [ ] Custom domain resolves to the marketing site
- [ ] ACM certificate status = **Issued**
- [ ] Budgets + CloudTrail + GuardDuty active
- [ ] SES production access requested

---

## 7. Phase 1 — Core Infrastructure (27 Jul – 14 Aug, 15–18 h)

### Goals
Every AWS resource provisioned by the existing Terraform, applied incrementally and verified module by module.

### Week 3 (27–31 Jul, ~6 h) — Network & registry

| Task | Est. | Detail |
|---|---|---|
| 1.1 `terraform.tfvars` finalization | 1 h | Fill all 25 variables from `terraform.tfvars.example`: region, `domain_name`, `database_type = "rds"`, ECS sizing (start 512 CPU / 1024 MB, 2 tasks), secrets. |
| 1.2 Apply `ecr` + `networking` | 2 h | `terraform apply -target=module.ecr -target=module.networking`. Verify: VPC 10.0.0.0/16, 2 public + 2 private subnets across AZs, NAT gateway, 3 security groups with least-privilege chain (ALB→ECS→RDS). |
| 1.3 First image push | 2 h | `docker build` the production image locally, tag, push to ECR using the output commands from `terraform output docker_build_and_push_commands`. Confirm image scan runs and review findings. |
| 1.4 Cost checkpoint | 0.5 h | NAT gateway is now billing (~$32/mo + data). Confirm expected in Cost Explorer. |

### Week 4 (3–7 Aug, ~6 h) — Secrets, database, logging

| Task | Est. | Detail |
|---|---|---|
| 1.5 Apply `secrets` | 1 h | JWT_SECRET, SECRET_KEY, Stripe, PayFast into Secrets Manager. Verify values with `aws secretsmanager get-secret-value` then purge them from shell history. |
| 1.6 Apply `database` (RDS) | 2.5 h | RDS PostgreSQL 16, private subnets only, 7-day automated backups, deletion protection ON. Save the generated connection string into Secrets Manager as `DATABASE_URL`. |
| 1.7 Run migrations against RDS | 1.5 h | From a bastion task or local tunnel, run the Drizzle PostgreSQL migrations (including `0031_token_revocation_pg.sql`). Verify tables with `\dt`. |
| 1.8 Apply `cloudwatch` | 0.5 h | Log group `/ecs/proteaai-prod` (set retention: 30 days), CPU/memory/unhealthy-host alarms created. |

### Week 5 (10–14 Aug, ~5 h) — IAM & load balancer

| Task | Est. | Detail |
|---|---|---|
| 1.9 Apply `iam` | 1 h | Task execution role (ECR pull, logs, secrets read) + task role. Review both policies manually — least privilege check. |
| 1.10 Apply `alb` | 1.5 h | ALB in public subnets, HTTP→HTTPS redirect, HTTPS listener with the ACM cert, target group health check on `/health` (interval 30 s, healthy threshold 2, timeout 10 s, grace period 120 s — the lesson from the Fly.io health-check timeout applies here too). |
| 1.11 Route 53 → ALB | 0.5 h | ALIAS record `app.proteaai.com` → ALB DNS name. It will 503 until Phase 2 — that's expected. |
| 1.12 Alarm → notification wiring | 1.5 h | SNS topic for alarms → email (and Slack via webhook if available). Test-fire one alarm. |

### Definition of done
- [ ] `terraform plan` shows zero drift on all modules except `ecs`
- [ ] ECR holds a scanned production image
- [ ] RDS reachable from private subnets only; migrations applied
- [ ] `https://app.proteaai.com` terminates TLS at the ALB (503 body is fine)
- [ ] Alarm email received in a live test

---

## 8. Phase 2 — First Deployment (17–28 Aug, 10–14 h)

### Goals
The application running on ECS Fargate, healthy behind the ALB, functionally smoke-tested in production.

### Week 6 (17–21 Aug, ~7 h)

| Task | Est. | Detail |
|---|---|---|
| 2.1 Apply `ecs` | 2 h | Cluster with Container Insights, task definition (secrets injected from Secrets Manager), service with 2 tasks, auto-scaling 2–10 on CPU/memory. |
| 2.2 First stabilization loop | 3 h | Realistic budget for the classic first-deploy issues: watch `aws logs tail /ecs/proteaai-prod --follow`; typical failures are missing env var, port mismatch (app must listen on 0.0.0.0:3001), health-check grace too short, or secret ARN typo. Iterate until target group shows 2/2 healthy. |
| 2.3 TLS + redirect verification | 0.5 h | `curl -I http://app.…` → 301 to https; `curl https://app.…/health` → 200. SSL Labs scan ≥ A. |
| 2.4 Manual smoke test | 1.5 h | Register account, log in, create app, run one AI build round-trip (with a real provider key), log out, confirm token revoked (`/auth/me` → 401 with old token). |

### Week 7 (24–28 Aug, ~5 h)

| Task | Est. | Detail |
|---|---|---|
| 2.5 E2E suite against production URL | 2 h | `E2E_BASE_URL=https://app.proteaai.com npx playwright test tests/e2e/` — auth, billing, apps suites must pass. Fix or ticket every failure. |
| 2.6 Billing round-trip (test mode) | 1.5 h | Stripe test-mode checkout end to end; webhook endpoint verified (Stripe CLI or dashboard test event); PayFast sandbox ITN round-trip. |
| 2.7 Ops notes | 1 h | Write `RUNBOOK.md` stubs: how to view logs, restart the service, roll back to previous task definition, connect to RDS. |

### Definition of done
- [ ] 2/2 ECS tasks healthy for 72 consecutive hours
- [ ] All three E2E suites green against the production URL
- [ ] Stripe test checkout + webhook verified
- [ ] Rollback procedure written and understood

---

## 9. Phase 3 — CI/CD & Staging (31 Aug – 11 Sep, 12–14 h)

### Goals
No more laptop deploys. Every change flows: PR → CI checks → merge → auto-deploy to staging → one-click promote to production.

### Week 8 (31 Aug – 4 Sep, ~7 h)

| Task | Est. | Detail |
|---|---|---|
| 3.1 GitHub OIDC → AWS | 1.5 h | IAM OIDC provider for GitHub Actions; deploy role assumable only by this repo's workflows. **No long-lived AWS keys in GitHub secrets.** |
| 3.2 CI workflow | 2.5 h | On PR: install, typecheck, lint, unit tests, `docker build`. On merge to `main`: build + tag image (`git sha`), push to ECR. |
| 3.3 CD workflow (staging) | 2 h | After image push: render new task definition, `aws ecs update-service` on staging, wait for stability, run smoke E2E against staging. |
| 3.4 Branch protection | 0.5 h | `main` requires green CI + 1 review (or admin) before merge. |

### Week 9 (7–11 Sep, ~6 h)

| Task | Est. | Detail |
|---|---|---|
| 3.5 Staging environment | 3 h | Second Terraform workspace/var-file: smaller sizing (1 task, RDS `db.t4g.micro` or SQLite/EFS to save cost), `staging.proteaai.com`, protected by basic auth or IP allowlist. |
| 3.6 Production promote job | 1.5 h | Manual-approval GitHub environment gate: "Promote to production" re-tags the staging-verified image and updates the prod service. Rolling deploy, zero downtime. |
| 3.7 Rollback drill | 1 h | Practice: promote a bad image (breaks `/health`), watch ECS circuit-break, roll back via previous task definition revision. Time it — must be < 10 min. |

### Definition of done
- [ ] Zero manual `docker push`/`update-service` needed for a release
- [ ] Staging auto-deploys on merge; prod behind a manual gate
- [ ] Rollback rehearsed and < 10 minutes
- [ ] No static AWS credentials in GitHub

---

## 10. Phase 4 — Hardening & Disaster Drills (14–25 Sep, 12–14 h)

### Goals
Survive attack, failure, and growth. Everything here is what separates "it runs" from "top of the industry."

### Week 10 (14–18 Sep, ~7 h)

| Task | Est. | Detail |
|---|---|---|
| 4.1 AWS WAF on the ALB | 2 h | Managed rule groups: Core rule set, Known bad inputs, IP reputation. Rate-based rule: 2 000 req/5 min per IP (tune later). Count-mode first 48 h, then block. |
| 4.2 App-level rate limits review | 1 h | Confirm login/register endpoints have tight limits (brute-force protection) and AI endpoints have per-user quotas tied to plan. |
| 4.3 Backup verification drill | 2.5 h | Restore the latest RDS snapshot to a temp instance, point a local app build at it, verify data integrity, destroy temp. **A backup is only real once restored.** Document RPO/RTO results vs targets (E4). |
| 4.4 Secret rotation procedure | 1 h | Document + rehearse rotating `JWT_SECRET` (forces re-login), Stripe keys, DB password. |

### Week 11 (21–25 Sep, ~6 h)

| Task | Est. | Detail |
|---|---|---|
| 4.5 Load test | 2.5 h | k6 or Artillery: ramp to 200 concurrent users on auth + app CRUD + one AI streaming session. Watch auto-scaling trigger. Record p95/p99; fix anything > 500 ms p95 on non-AI endpoints. |
| 4.6 Security pass | 2 h | Dependency audit (`npm audit`, ECR image scan findings), security headers check (CSP, X-Frame-Options, HSTS), confirm no secrets in logs, confirm GDPR endpoints auth-gated (E2E already covers). |
| 4.7 Uptime monitor + status page | 1 h | External uptime checks (e.g. UptimeRobot/Better Stack, 1-min interval on `/health` and the login page) + public status page at `status.proteaai.com`. |
| 4.8 On-call reality check | 0.5 h | With one part-time DevOps: alarms → email + phone push; define "business-hours best effort" support promise honestly in docs/SLA wording. |

### Definition of done
- [ ] WAF in block mode with zero false positives over 48 h
- [ ] Restore drill completed; RPO ≤ 24 h, RTO ≤ 4 h demonstrated
- [ ] Load test report saved; p95 targets met
- [ ] Public status page live

---

## 11. Phase 5 — Marketing Integration & Private Beta (28 Sep – 9 Oct, 10–12 h)

### Goals
The funnel: visitor lands on the marketing site → understands the product in 10 seconds → clicks through → signs up → builds an app → (eventually) pays. Plus 20–50 real beta users banging on production before the public does.

### Week 12 (28 Sep – 2 Oct, ~6 h)

| Task | Est. | Detail |
|---|---|---|
| 5.1 Marketing site CTA wiring | 1.5 h | Every "Get started / Launch app / Sign up" button on the Base44 site → `https://app.proteaai.com/signup?utm_source=marketing&utm_medium=cta&utm_campaign=launch`. "Log in" link → `/login`. Download links for the desktop app → latest release. |
| 5.2 Marketing content truth pass | 1.5 h | Ensure the site states the real differentiators (§2.3): dual-mode, BYO-keys, code ownership, diff-approval trust story, Stripe+PayFast. Pricing page matches actual Stripe prices. Screenshots are of the real product. |
| 5.3 Analytics | 1.5 h | Privacy-friendly analytics (e.g. Plausible/PostHog) on both marketing site and app. Events: `signup_started`, `signup_completed`, `first_app_created`, `first_ai_build`, `checkout_started`, `subscription_active`. This is goal G2's measurement. |
| 5.4 Legal pages | 1.5 h | Terms of Service, Privacy Policy (GDPR + POPIA — SA market), Cookie notice, refund policy. Linked in app footer and signup checkbox. Use a reputable generator + human review; ticket a proper legal review post-launch. |

### Week 13 (5–9 Oct, ~5 h)

| Task | Est. | Detail |
|---|---|---|
| 5.5 Transactional email live | 1 h | SES production mode (requested in Phase 0): welcome email, password reset, receipt emails. SPF/DKIM/DMARC all pass (check via mail-tester). |
| 5.6 Support channel | 1 h | `support@proteaai.com` inbox (or shared tool), linked in app + site. Auto-reply with expected response time. |
| 5.7 Private beta | 2 h | Invite 20–50 users (network, waitlist). Watch analytics + logs daily. Triage into: launch-blocker / fix-fast / backlog. |
| 5.8 Stripe/PayFast to LIVE mode | 1 h | Swap publishable/secret keys to live in Secrets Manager, re-verify webhook signing secret, run one real R10/$1 charge and refund it. |

### Definition of done
- [ ] Full funnel works: marketing click → signup → build → checkout (live mode, real card, refunded)
- [ ] Analytics events flowing from both properties
- [ ] Legal pages published and linked
- [ ] ≥ 20 beta users; zero open launch-blockers

---

## 12. Phase 6 — Launch Week (12–16 Oct, 6–8 h)

### Mon 12 Oct — Freeze & final checks (~2 h)
- Code freeze: only launch-blocker fixes merge.
- Final `terraform plan` — must be clean.
- Re-run full E2E against production. Verify backups ran last night. Verify alarms armed.
- Scale floor up for launch: ECS minimum 3 tasks (absorbs the traffic spike without waiting on scale-out).

### Wed 14 Oct — Dress rehearsal (~1.5 h)
- Walk the entire runbook below with a stopwatch.
- Pre-write the incident comms templates (status page + social).
- Confirm the marketing site is publishing the launch announcement on schedule.

### Thu 15 Oct — **LAUNCH DAY** (~3 h spread across the day)

| Time (SAST) | Action |
|---|---|
| 08:00 | Health sweep: `/health`, E2E smoke, dashboards green, error rate baseline noted |
| 09:00 | Marketing site announcement live; social posts out; (optional) Product Hunt/HN post |
| 09:00–17:00 | Monitor: CloudWatch dashboard + logs open; check every ~45 min. Watch signups funnel in analytics |
| 12:00 | Midday checkpoint: error rate, latency p95, signup count, any WAF blocks of real users |
| 17:00 | End-of-day report: signups, activation (first app created), incidents, costs |

**Launch-day thresholds (act, don't debate):**
- Error rate > 2% for 10 min → investigate immediately; > 5% → roll back last deploy.
- p95 > 2 s sustained → raise task count manually (`desired-count`), investigate after.
- Any security anomaly (GuardDuty finding, auth anomaly) → treat as P1.

### Fri 16 Oct — Stabilize (~1 h)
- Triage everything from day one. Thank beta users. Reset ECS floor to 2 tasks if traffic allows.

---

## 13. Scope Levers (protecting the date)

If the schedule slips, cut in this order — never cut items marked 🔒:

| Cut order | Item | Consequence |
|---|---|---|
| 1 | `api.proteaai.com` public API subdomain | None at launch; app uses same-origin |
| 2 | Staging environment (deploy straight to prod behind manual gate) | Higher release risk; restore in Phase 7 |
| 3 | PayFast live activation (launch Stripe-only) | SA cards still work via Stripe; PayFast follows within 2 weeks |
| 4 | Status page | Use social/X for incident comms temporarily |
| 🔒 | WAF, backups + restore drill, token revocation, TLS, alarms, legal pages | Never cut — these are launch-blockers by definition |

---

## 14. Post-Launch Roadmap (Phase 7+, from 19 Oct)

### Weeks 1–4 (stabilization, 3–5 h/wk)
- Daily: dashboard + error triage (15 min). Weekly: cost review, dependency updates.
- Tune auto-scaling and WAF from real traffic. Right-size RDS/ECS from actual utilization.
- First paid-cohort review vs G3; fix the top 3 funnel drop-offs analytics reveals.

### Months 2–3 (growth & moat)
- **Reliability:** multi-AZ RDS, canary deploys, error-budget policy for the 99.9% target.
- **Product-led growth:** public template gallery of apps built with ProteaAI (each is marketing), shareable read-only app previews, referral credits.
- **Enterprise track:** SSO (SAML/OIDC), audit logs, team workspaces — the pricing tier that funds the business.
- **Compliance:** begin SOC 2 Type I groundwork (CloudTrail/GuardDuty from Phase 0 already count as evidence).
- **Content engine:** weekly build-in-public posts + SEO pages per app template ("build a CRM with AI") pointing at the marketing site.

### "Top of the industry" scorecard (review monthly)

| Dimension | Metric | Industry-leading target |
|---|---|---|
| Reliability | Uptime | ≥ 99.9% |
| Speed | Time from signup → first working app | < 5 minutes |
| Trust | Every AI change user-approved via diff | 100% (already built) |
| Openness | User can export full code of their app | 100% (already built) |
| Reach | Payment methods | Global (Stripe) + SA (PayFast) |
| Transparency | Public status page + changelog | Live |

---

## 15. Cost Forecast (monthly, USD, production)

| Item | Launch config | Est. cost |
|---|---|---|
| ECS Fargate (2× 0.5 vCPU / 1 GB, 24/7) | 2 tasks | ~$36 |
| ALB | 1 | ~$20–25 |
| NAT Gateway | 1 | ~$32 + data |
| RDS PostgreSQL `db.t4g.small`, 20 GB, single-AZ | 1 | ~$30 |
| Secrets Manager | 6–8 secrets | ~$3 |
| CloudWatch (logs 30-day retention, alarms, dashboard) | — | ~$10–15 |
| ECR, S3, DynamoDB, Route 53 | — | ~$5 |
| WAF | Managed rules | ~$10–15 |
| SES | < 10 k emails | ~$1 |
| **AWS total** | | **~$150–180/mo** |
| Uptime/status page (Better Stack free tier or similar) | | $0–15 |
| Analytics (Plausible/PostHog) | | $0–19 |
| Staging (smaller sizing, can stop nights) | | ~$40–60 |
| **Grand total** | | **~$190–275/mo** |

Multi-AZ RDS (+$30) and a third ECS task (+$18) are the first upgrades once revenue justifies them. Reserve ~$50/mo headroom for data transfer growth.

---

## 16. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | 5–7 h/wk proves insufficient in a given week | High | Schedule slip | 20% buffer built in; scope levers (§13); phases sized ≤ 7 h/wk |
| R2 | First ECS deploy fails repeatedly (env/health-check issues) | Medium | Phase 2 slip | 3 h stabilization budget pre-allocated; known failure list documented from the Fly.io incident |
| R3 | SES production access delayed | Medium | No transactional email | Requested in Phase 0 (weeks of lead time); fallback: Resend/Postmark |
| R4 | Domain change decision lands late | Medium | DNS/cert rework | All Terraform takes `domain_name` as a variable; cert re-issue is ~1 h. Decide by end of Phase 0 |
| R5 | Launch-day traffic spike | Medium | Slow/queued requests | Floor of 3 tasks on launch day; auto-scaling to 10; WAF rate limiting |
| R6 | Single part-time DevOps = bus factor 1 | High | Ops fragility | RUNBOOK.md kept current every phase; all infra is code; founder gets read access to dashboards |
| R7 | Payment webhook misconfiguration in live mode | Medium | Silent revenue loss | Live-mode $1 charge + refund test (5.8); webhook delivery alarms |
| R8 | AI provider outage (upstream) | Medium | Core feature down | BYO-key multi-provider support is the mitigation; status page distinguishes "our infra" vs "provider" incidents |
| R9 | Cost overrun (NAT data, log volume) | Low | Budget pressure | Budgets alarms from Phase 0; 30-day log retention; monthly cost review |

---

## 17. Weekly Operating Rhythm (for the DevOps engineer)

Every week, in priority order — the phase tasks fit around this ~45-minute baseline:

1. **Mon (15 min):** dashboard review — errors, latency, healthy hosts, cost anomalies.
2. **Mon (15 min):** confirm last night's RDS backup exists; skim GuardDuty/WAF.
3. **During week:** phase tasks per this plan (log actual hours against estimates).
4. **Fri (15 min):** update the phase checklist in this document; note slips ≥ 2 h and apply scope levers early rather than late.

---

## 18. Definition of "Launched"

The platform is launched when **all** of the following are simultaneously true:

- [ ] `https://app.proteaai.com` (final domain) serves the platform with a valid TLS cert
- [ ] Marketing site live on the custom domain with working CTAs into the app
- [ ] Signups open to the public; welcome email delivered
- [ ] A stranger can: sign up → create an app → run an AI build → export code — unaided
- [ ] Live payments work (Stripe minimum; PayFast within 2 weeks)
- [ ] 2+ ECS tasks healthy; alarms armed; status page public
- [ ] Backups verified by an actual restore within the last 30 days
- [ ] CI/CD deploys with rollback < 10 min
- [ ] Legal pages published; analytics measuring the funnel

---

*Maintained in the repository root. Update the phase checklists weekly; treat every unchecked box past its window as a scheduling decision, not a surprise.*
