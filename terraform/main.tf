terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment to store state in S3 (recommended for production)
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket"
  #   key            = "proteaai/prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Application = "proteaai"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# VPC and Networking
module "networking" {
  source = "./modules/networking"

  app_name    = var.app_name
  environment = var.environment
  region      = var.region
}

# Secrets Manager
module "secrets" {
  source = "./modules/secrets"

  app_name               = var.app_name
  environment            = var.environment
  jwt_secret             = var.jwt_secret
  secret_key             = var.secret_key
  stripe_secret_key      = var.stripe_secret_key
  stripe_webhook_secret  = var.stripe_webhook_secret
  payfast_merchant_id    = var.payfast_merchant_id
  payfast_merchant_key   = var.payfast_merchant_key
  payfast_passphrase     = var.payfast_passphrase
}

# Database (EFS or RDS)
module "database" {
  source = "./modules/database"

  app_name               = var.app_name
  environment            = var.environment
  database_type          = var.database_type
  vpc_id                 = module.networking.vpc_id
  private_subnet_ids     = module.networking.private_subnet_ids
  rds_security_group_id  = module.networking.rds_security_group_id
  rds_username           = var.rds_username
  rds_password           = var.rds_password
  rds_instance_class     = var.rds_instance_class
}

# CloudWatch Logs
module "cloudwatch" {
  source = "./modules/cloudwatch"

  app_name    = var.app_name
  environment = var.environment
}

# IAM Roles
module "iam" {
  source = "./modules/iam"

  app_name       = var.app_name
  environment    = var.environment
  secrets_arns   = module.secrets.secrets_arn
  log_group_arn  = module.cloudwatch.log_group_arn
  database_type  = var.database_type
  efs_id         = var.database_type == "efs" ? module.database.efs_id : null
}

# ECS Cluster and Service
module "ecs" {
  source = "./modules/ecs"

  app_name                     = var.app_name
  environment                  = var.environment
  region                       = var.region
  container_image              = var.container_image
  container_port               = var.container_port
  ecs_cpu                      = var.ecs_cpu
  ecs_memory                   = var.ecs_memory
  ecs_min_capacity             = var.ecs_min_capacity
  ecs_max_capacity             = var.ecs_max_capacity
  ecs_target_cpu_utilization   = var.ecs_target_cpu_utilization
  ecs_target_memory_utilization = var.ecs_target_memory_utilization
  private_subnet_ids           = module.networking.private_subnet_ids
  ecs_security_group_id        = module.networking.ecs_security_group_id
  alb_target_group_arn         = module.alb.target_group_arn
  log_group_name               = module.cloudwatch.log_group_name
  ecs_task_execution_role_arn  = module.iam.ecs_task_execution_role_arn
  ecs_task_role_arn            = module.iam.ecs_task_role_arn
  secrets_arns                 = module.secrets.secrets_arn
  database_type                = var.database_type
  efs_id                       = var.database_type == "efs" ? module.database.efs_id : null
  rds_endpoint                 = var.database_type == "rds" ? module.database.rds_endpoint : null

  environment_variables = [
    {
      name  = "NODE_ENV"
      value = "production"
    },
    {
      name  = "CORS_ORIGIN"
      value = "https://${var.domain_name}"
    },
    {
      name  = "APP_BASE_URL"
      value = "https://${var.domain_name}"
    },
    {
      name  = "STRIPE_PRO_PRICE_ID"
      value = var.stripe_pro_price_id
    },
    {
      name  = "PAYFAST_SANDBOX"
      value = var.payfast_sandbox
    },
    {
      name  = "PAYFAST_PRO_AMOUNT"
      value = var.payfast_pro_amount
    }
  ]

  depends_on = [module.iam, module.cloudwatch, module.database, module.alb]
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"

  app_name              = var.app_name
  environment           = var.environment
  vpc_id                = module.networking.vpc_id
  public_subnet_ids     = module.networking.public_subnet_ids
  alb_security_group_id = module.networking.alb_security_group_id
  container_port        = var.container_port
  domain_name           = var.domain_name
}
