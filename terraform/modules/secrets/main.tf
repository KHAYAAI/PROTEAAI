variable "app_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "secret_key" {
  type      = string
  sensitive = true
}

variable "stripe_secret_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "stripe_webhook_secret" {
  type      = string
  sensitive = true
  default   = ""
}

variable "payfast_merchant_id" {
  type      = string
  sensitive = true
  default   = ""
}

variable "payfast_merchant_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "payfast_passphrase" {
  type      = string
  sensitive = true
  default   = ""
}

output "jwt_secret_arn" {
  value = aws_secretsmanager_secret.jwt_secret.arn
}

output "secret_key_arn" {
  value = aws_secretsmanager_secret.secret_key.arn
}

output "stripe_secret_key_arn" {
  value = var.stripe_secret_key != "" ? aws_secretsmanager_secret.stripe_secret_key[0].arn : ""
}

output "stripe_webhook_secret_arn" {
  value = var.stripe_webhook_secret != "" ? aws_secretsmanager_secret.stripe_webhook_secret[0].arn : ""
}

output "payfast_merchant_id_arn" {
  value = var.payfast_merchant_id != "" ? aws_secretsmanager_secret.payfast_merchant_id[0].arn : ""
}

output "payfast_merchant_key_arn" {
  value = var.payfast_merchant_key != "" ? aws_secretsmanager_secret.payfast_merchant_key[0].arn : ""
}

output "payfast_passphrase_arn" {
  value = var.payfast_passphrase != "" ? aws_secretsmanager_secret.payfast_passphrase[0].arn : ""
}

output "secrets_arn" {
  value = concat(
    [aws_secretsmanager_secret.jwt_secret.arn, aws_secretsmanager_secret.secret_key.arn],
    var.stripe_secret_key != "" ? [aws_secretsmanager_secret.stripe_secret_key[0].arn] : [],
    var.stripe_webhook_secret != "" ? [aws_secretsmanager_secret.stripe_webhook_secret[0].arn] : [],
    var.payfast_merchant_id != "" ? [aws_secretsmanager_secret.payfast_merchant_id[0].arn] : [],
    var.payfast_merchant_key != "" ? [aws_secretsmanager_secret.payfast_merchant_key[0].arn] : [],
    var.payfast_passphrase != "" ? [aws_secretsmanager_secret.payfast_passphrase[0].arn] : []
  )
}

# Required secrets
resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${var.app_name}/${var.environment}/jwt-secret"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.app_name}-jwt-secret"
  }
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id       = aws_secretsmanager_secret.jwt_secret.id
  secret_string   = var.jwt_secret
  version_stages = ["AWSCURRENT"]
}

resource "aws_secretsmanager_secret" "secret_key" {
  name                    = "${var.app_name}/${var.environment}/secret-key"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.app_name}-secret-key"
  }
}

resource "aws_secretsmanager_secret_version" "secret_key" {
  secret_id       = aws_secretsmanager_secret.secret_key.id
  secret_string   = var.secret_key
  version_stages = ["AWSCURRENT"]
}

# Stripe secrets (optional)
resource "aws_secretsmanager_secret" "stripe_secret_key" {
  count                   = var.stripe_secret_key != "" ? 1 : 0
  name                    = "${var.app_name}/${var.environment}/stripe-secret-key"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.app_name}-stripe-secret-key"
  }
}

resource "aws_secretsmanager_secret_version" "stripe_secret_key" {
  count           = var.stripe_secret_key != "" ? 1 : 0
  secret_id       = aws_secretsmanager_secret.stripe_secret_key[0].id
  secret_string   = var.stripe_secret_key
  version_stages = ["AWSCURRENT"]
}

resource "aws_secretsmanager_secret" "stripe_webhook_secret" {
  count                   = var.stripe_webhook_secret != "" ? 1 : 0
  name                    = "${var.app_name}/${var.environment}/stripe-webhook-secret"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.app_name}-stripe-webhook-secret"
  }
}

resource "aws_secretsmanager_secret_version" "stripe_webhook_secret" {
  count           = var.stripe_webhook_secret != "" ? 1 : 0
  secret_id       = aws_secretsmanager_secret.stripe_webhook_secret[0].id
  secret_string   = var.stripe_webhook_secret
  version_stages = ["AWSCURRENT"]
}

# PayFast secrets (optional)
resource "aws_secretsmanager_secret" "payfast_merchant_id" {
  count                   = var.payfast_merchant_id != "" ? 1 : 0
  name                    = "${var.app_name}/${var.environment}/payfast-merchant-id"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.app_name}-payfast-merchant-id"
  }
}

resource "aws_secretsmanager_secret_version" "payfast_merchant_id" {
  count           = var.payfast_merchant_id != "" ? 1 : 0
  secret_id       = aws_secretsmanager_secret.payfast_merchant_id[0].id
  secret_string   = var.payfast_merchant_id
  version_stages = ["AWSCURRENT"]
}

resource "aws_secretsmanager_secret" "payfast_merchant_key" {
  count                   = var.payfast_merchant_key != "" ? 1 : 0
  name                    = "${var.app_name}/${var.environment}/payfast-merchant-key"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.app_name}-payfast-merchant-key"
  }
}

resource "aws_secretsmanager_secret_version" "payfast_merchant_key" {
  count           = var.payfast_merchant_key != "" ? 1 : 0
  secret_id       = aws_secretsmanager_secret.payfast_merchant_key[0].id
  secret_string   = var.payfast_merchant_key
  version_stages = ["AWSCURRENT"]
}

resource "aws_secretsmanager_secret" "payfast_passphrase" {
  count                   = var.payfast_passphrase != "" ? 1 : 0
  name                    = "${var.app_name}/${var.environment}/payfast-passphrase"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.app_name}-payfast-passphrase"
  }
}

resource "aws_secretsmanager_secret_version" "payfast_passphrase" {
  count           = var.payfast_passphrase != "" ? 1 : 0
  secret_id       = aws_secretsmanager_secret.payfast_passphrase[0].id
  secret_string   = var.payfast_passphrase
  version_stages = ["AWSCURRENT"]
}
