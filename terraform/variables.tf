variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (prod, staging, dev)"
  type        = string
  default     = "prod"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "proteaai"
}

variable "domain_name" {
  description = "Domain name for the application (e.g., api.yourdomain.com)"
  type        = string
}

variable "container_image" {
  description = "Docker image URI (e.g., <account>.dkr.ecr.us-east-1.amazonaws.com/proteaai:latest)"
  type        = string
}

variable "container_port" {
  description = "Container port"
  type        = number
  default     = 3001
}

variable "database_type" {
  description = "Database type: 'efs' for SQLite or 'rds' for PostgreSQL"
  type        = string
  default     = "efs"
  validation {
    condition     = contains(["efs", "rds"], var.database_type)
    error_message = "database_type must be either 'efs' or 'rds'."
  }
}

# Secrets
variable "jwt_secret" {
  description = "JWT secret (64-char hex). Generate: openssl rand -hex 32"
  type        = string
  sensitive   = true
}

variable "secret_key" {
  description = "Settings encryption key (64-char hex). Generate: openssl rand -hex 32"
  type        = string
  sensitive   = true
}

variable "stripe_secret_key" {
  description = "Stripe secret key (sk_live_...)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook secret (whsec_...)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_pro_price_id" {
  description = "Stripe Pro plan price ID (price_...)"
  type        = string
  default     = ""
}

variable "payfast_merchant_id" {
  description = "PayFast merchant ID"
  type        = string
  sensitive   = true
  default     = ""
}

variable "payfast_merchant_key" {
  description = "PayFast merchant key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "payfast_passphrase" {
  description = "PayFast passphrase (set in account settings)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "payfast_sandbox" {
  description = "PayFast sandbox mode ('true' for testing, 'false' for production)"
  type        = string
  default     = "false"
}

variable "payfast_pro_amount" {
  description = "PayFast Pro plan amount in ZAR"
  type        = string
  default     = "149.00"
}

# RDS Configuration
variable "rds_username" {
  description = "RDS master username (only for database_type='rds')"
  type        = string
  default     = "proteaai"
}

variable "rds_password" {
  description = "RDS master password (only for database_type='rds'). Must be 20+ chars with special chars."
  type        = string
  sensitive   = true
  default     = ""
}

variable "rds_instance_class" {
  description = "RDS instance class (e.g., db.t3.micro, db.t3.small)"
  type        = string
  default     = "db.t3.micro"
}

# ECS Configuration
variable "ecs_cpu" {
  description = "ECS task CPU units (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 512
}

variable "ecs_memory" {
  description = "ECS task memory in MB (512, 1024, 2048, 3072, 4096)"
  type        = number
  default     = 1024
}

variable "ecs_min_capacity" {
  description = "Minimum number of ECS tasks"
  type        = number
  default     = 1
}

variable "ecs_max_capacity" {
  description = "Maximum number of ECS tasks"
  type        = number
  default     = 4
}

variable "ecs_target_cpu_utilization" {
  description = "Target CPU utilization for auto-scaling (%)"
  type        = number
  default     = 70
}

variable "ecs_target_memory_utilization" {
  description = "Target memory utilization for auto-scaling (%)"
  type        = number
  default     = 80
}
