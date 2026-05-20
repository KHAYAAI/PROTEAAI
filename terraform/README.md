# ProteaAI on AWS — Infrastructure as Code

Complete Terraform setup for deploying ProteaAI on AWS ECS Fargate with modular infrastructure.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Route 53 (DNS) → ACM Certificate (SSL/TLS)                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ ALB (Application Load Balancer)                             │
│ ├─ Port 80 → Redirect to HTTPS                             │
│ └─ Port 443 → ECS Fargate Service                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ VPC (10.0.0.0/16)                                           │
│ ├─ Public Subnets (10.0.1.0/24, 10.0.2.0/24)               │
│ │  └─ NAT Gateway (for private subnet egress)              │
│ │                                                           │
│ └─ Private Subnets (10.0.11.0/24, 10.0.12.0/24)            │
│    └─ ECS Fargate Service                                  │
│       ├─ EFS Volume (/data for SQLite) OR                  │
│       └─ RDS PostgreSQL (DATABASE_URL)                     │
└─────────────────────────────────────────────────────────────┘

Secrets Manager (JWT_SECRET, SECRET_KEY, API keys)
CloudWatch Logs (/ecs/proteaai-prod)
```

## Quick Start

### Prerequisites
- AWS Account with appropriate permissions
- Terraform 1.0+
- AWS CLI v2
- Docker (to build container image)

### 1. Prepare Terraform Variables

```bash
cd terraform

# Copy example configuration
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
vim terraform.tfvars
```

Key variables to set:
- `region` — AWS region (e.g., `us-east-1`)
- `app_name` — Application name (e.g., `proteaai`)
- `environment` — Deployment environment (e.g., `prod`, `staging`)
- `domain_name` — Your domain (e.g., `app.yourdomain.com`)
- `container_image` — ECR image URI (built in step 2)
- `jwt_secret` — Generate: `openssl rand -hex 32`
- `secret_key` — Generate: `openssl rand -hex 32`
- `database_type` — `efs` (SQLite) or `rds` (PostgreSQL)

### 2. Build & Push Docker Image

```bash
# Build Docker image
docker build -t proteaai .

# Create ECR repository
aws ecr create-repository --repository-name proteaai --region us-east-1

# Get ECR login token
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com

# Tag image
docker tag proteaai:latest <account>.dkr.ecr.us-east-1.amazonaws.com/proteaai:latest

# Push to ECR
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/proteaai:latest

# Update terraform.tfvars with the full image URI
```

### 3. Initialize Terraform

```bash
terraform init
```

This downloads AWS provider plugins and initializes the backend.

### 4. Plan Deployment

```bash
terraform plan -out=tfplan
```

Review the resources that will be created.

### 5. Deploy

```bash
terraform apply tfplan
```

This creates:
- VPC with public/private subnets
- Application Load Balancer with HTTPS
- ECS Fargate cluster and service
- Database (EFS for SQLite or RDS for PostgreSQL)
- CloudWatch log groups
- IAM roles with least-privilege access
- Secrets Manager entries for sensitive variables

### 6. Get Deployment Outputs

```bash
terraform output
```

Example output:
```
alb_dns_name = "proteaai-alb-123456789.us-east-1.elb.amazonaws.com"
ecs_cluster_name = "proteaai-prod-cluster"
cloudwatch_log_group_name = "/ecs/proteaai-prod"
```

### 7. Configure DNS

Update your domain registrar (Route 53, Namecheap, etc.) to point to the ALB DNS name:

```
api.yourdomain.com  CNAME  proteaai-alb-123456789.us-east-1.elb.amazonaws.com
```

Allow 5–15 minutes for DNS propagation.

### 8. Verify Deployment

```bash
# Check health endpoint
curl -v https://api.yourdomain.com/health

# Check logs
aws logs tail /ecs/proteaai-prod --follow

# List ECS tasks
aws ecs list-tasks --cluster proteaai-prod-cluster

# Check target group health
aws elbv2 describe-target-health \
  --target-group-arn $(terraform output -raw target_group_arn)
```

## Module Structure

```
modules/
├── networking/     # VPC, subnets, security groups, NAT gateway
├── secrets/        # AWS Secrets Manager for env vars
├── database/       # EFS volume (SQLite) and RDS PostgreSQL
├── iam/            # Task execution role, task role, policies
├── cloudwatch/     # Log groups and CloudWatch alarms
├── ecs/            # ECS cluster, task definition, service, auto-scaling
└── alb/            # Application Load Balancer, listeners, ACM certificate
```

## Environment Variables

The Terraform setup automatically configures:

**From Secrets Manager:**
- `JWT_SECRET` — JWT signing key
- `SECRET_KEY` — Settings encryption key
- `STRIPE_SECRET_KEY` — Stripe API key (if configured)
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing key (if configured)
- `PAYFAST_MERCHANT_ID` — PayFast merchant ID (if configured)
- `PAYFAST_MERCHANT_KEY` — PayFast merchant key (if configured)
- `PAYFAST_PASSPHRASE` — PayFast passphrase (if configured)

**Hardcoded:**
- `NODE_ENV` — Always `production`
- `PORT` — Always `3001`
- `PROTEAAI_DATA_DIR` — `/data` for EFS, `/tmp` for RDS
- `CORS_ORIGIN` — Your domain
- `APP_BASE_URL` — Your domain
- `DATABASE_URL` — RDS connection string (if using RDS)
- `STRIPE_PRO_PRICE_ID` — Stripe price ID (from terraform.tfvars)
- `PAYFAST_SANDBOX` — Sandbox mode flag (from terraform.tfvars)
- `PAYFAST_PRO_AMOUNT` — PayFast amount in ZAR (from terraform.tfvars)

## Database Options

### Option 1: SQLite with EFS (Recommended for <50K Users)

```hcl
database_type = "efs"
```

- **Pros:** Simple setup, no additional costs, good for development/small scale
- **Cons:** Not suitable for 100K+ users, single-zone failure
- **Cost:** ~$5–15/month for EFS
- **Setup:** Terraform auto-creates EFS and mounts at `/data`

### Option 2: PostgreSQL with RDS (Recommended for Production)

```hcl
database_type = "rds"
rds_username = "proteaai"
rds_password = "<generated-password>"
rds_instance_class = "db.t3.micro"
```

- **Pros:** Managed database, automatic backups, multi-AZ capable, scales to 1M+ users
- **Cons:** Higher cost, more setup complexity
- **Cost:** ~$15–50/month depending on instance class
- **Scaling:** Start with `db.t3.micro`, upgrade to `db.t3.small` at 50K users, `db.t3.medium` at 200K users

When using RDS, run migrations:

```bash
aws ecs execute-command \
  --cluster $(terraform output -raw ecs_cluster_name) \
  --task <task-id> \
  --container proteaai \
  --command "npx drizzle-kit push --config drizzle.config.pg.ts" \
  --interactive
```

## Scaling Configuration

Auto-scaling is configured in the ECS module:

```hcl
ecs_min_capacity = 1                        # At least 1 task running
ecs_max_capacity = 4                        # Scale up to 4 tasks
ecs_target_cpu_utilization = 70             # Target 70% CPU
ecs_target_memory_utilization = 80          # Target 80% memory
```

Adjust in `terraform.tfvars` based on expected load:

| Users | CPU | Memory | Min | Max |
|---|---|---|---|---|
| 0–5K | 256 | 512 MB | 1 | 2 |
| 5K–50K | 512 | 1024 MB | 1 | 4 |
| 50K–100K | 1024 | 2048 MB | 2 | 6 |
| 100K+ | 2048 | 4096 MB | 3 | 10+ |

## Monitoring & Logging

### CloudWatch Logs

View real-time logs:
```bash
aws logs tail /ecs/proteaai-prod --follow
```

Filter by error level:
```bash
aws logs tail /ecs/proteaai-prod --follow --filter-pattern "ERROR"
```

### CloudWatch Alarms

Alarms are automatically created for:
- **ECS CPU Utilization** — Triggers at >80%
- **ECS Memory Utilization** — Triggers at >80%
- **Unhealthy Host Count** — Triggers if any target becomes unhealthy

View alarms:
```bash
aws cloudwatch describe-alarms --region us-east-1
```

### Health Checks

The ALB health check endpoint is `/health`:
```bash
curl https://api.yourdomain.com/health
# Response: { "ok": true, "version": "1.0.0" }
```

## Troubleshooting

### Task keeps restarting

Check logs:
```bash
aws logs tail /ecs/proteaai-prod --follow
```

Common causes:
- Missing environment variables in Secrets Manager
- `JWT_SECRET` or `SECRET_KEY` not set
- Container image not found in ECR
- Insufficient memory/CPU allocated

### Slow health checks

Check ECS task:
```bash
aws ecs describe-tasks --cluster proteaai-prod --tasks <task-arn>
```

If health check is failing:
- Increase `deregistration_delay` in ALB target group
- Check CloudWatch logs for startup errors
- Verify security groups allow ALB → ECS traffic

### Database connection errors

If using RDS:
```bash
# Check RDS instance status
aws rds describe-db-instances --db-instance-identifier proteaai-prod

# Verify security group allows ECS → RDS (port 5432)
aws ec2 describe-security-groups --group-ids <rds-sg-id>
```

If using EFS:
```bash
# Check EFS status
aws efs describe-file-systems

# Check mount targets
aws efs describe-mount-targets --file-system-id <efs-id>
```

### DNS not resolving

Wait 5–15 minutes for DNS propagation, then:
```bash
dig api.yourdomain.com
nslookup api.yourdomain.com
```

## Cost Estimation

| Configuration | Monthly Cost | Suitable For |
|---|---|---|
| **Dev Setup** | ~$25 | Personal use, testing |
| Fargate 256 CPU + EFS | $15–20 | < 1K users |
| **Small Production** | ~$40 | 1K–5K users |
| Fargate 512 CPU + EFS | $25–35 | |
| **Medium Production** | ~$100 | 5K–100K users |
| Fargate 1024 CPU + RDS t3.micro | $50–80 | |
| **Large Production** | ~$300+ | 100K+ users |
| Fargate 2048 CPU + RDS t3.small | $150–250 | |

*Costs include: Fargate, EFS/RDS, ALB, NAT gateway, CloudWatch, data transfer.*

## Disaster Recovery

### Backup Strategy

**EFS (SQLite):**
```bash
# Manual snapshot
aws efs create-backup-vault --backup-vault-name proteaai-backups
```

**RDS (PostgreSQL):**
```bash
# Automated backups enabled (7-day retention)
# Manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier proteaai-prod \
  --db-snapshot-identifier proteaai-prod-backup-$(date +%Y%m%d)
```

### Restore Procedure

**EFS:**
1. Create new EFS from snapshot
2. Scale down ECS service to 0
3. Detach old EFS, attach new one
4. Scale ECS service back up

**RDS:**
1. Create new DB from snapshot
2. Update `DATABASE_URL` environment variable
3. Redeploy ECS service

## Cleanup

To destroy all AWS resources:

```bash
terraform destroy
```

This removes:
- ECS cluster and service
- ALB and target groups
- RDS instance (with final snapshot)
- EFS volume
- VPC and subnets
- IAM roles
- Secrets Manager entries
- CloudWatch log groups

**Warning:** This is not reversible. Ensure you have backups before running.

## Support & Documentation

- [Terraform AWS Provider Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/)
- [RDS PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
- [ALB Documentation](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/)
