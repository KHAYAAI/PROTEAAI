variable "app_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "database_type" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "rds_security_group_id" {
  type = string
}

variable "rds_username" {
  type = string
}

variable "rds_password" {
  type      = string
  sensitive = true
}

variable "rds_instance_class" {
  type = string
}

output "efs_id" {
  value = var.database_type == "efs" ? aws_efs_file_system.main[0].id : null
}

output "efs_mount_target_ids" {
  value = var.database_type == "efs" ? aws_efs_mount_target.main[*].id : []
}

output "rds_endpoint" {
  value = var.database_type == "rds" ? aws_db_instance.main[0].endpoint : null
}

output "rds_database_name" {
  value = var.database_type == "rds" ? aws_db_instance.main[0].db_name : null
}

# EFS for SQLite storage (optional, used when database_type = "efs")
resource "aws_efs_file_system" "main" {
  count            = var.database_type == "efs" ? 1 : 0
  creation_token   = "${var.app_name}-${var.environment}"
  performance_mode = "generalPurpose"
  throughput_mode  = "bursting"

  tags = {
    Name = "${var.app_name}-efs"
  }
}

resource "aws_efs_mount_target" "main" {
  count           = var.database_type == "efs" ? length(var.private_subnet_ids) : 0
  file_system_id  = aws_efs_file_system.main[0].id
  subnet_id       = var.private_subnet_ids[count.index]
  security_groups = [aws_security_group.efs[0].id]
}

resource "aws_security_group" "efs" {
  count       = var.database_type == "efs" ? 1 : 0
  name        = "${var.app_name}-efs-sg"
  description = "Security group for EFS"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = []  # Will be set by ECS security group in ecs module
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.app_name}-efs-sg"
  }
}

# RDS PostgreSQL instance (optional, used when database_type = "rds")
resource "aws_db_instance" "main" {
  count                   = var.database_type == "rds" ? 1 : 0
  identifier              = "${var.app_name}-${var.environment}"
  engine                  = "postgres"
  engine_version          = "16.1"
  instance_class          = var.rds_instance_class
  allocated_storage       = 20
  storage_type            = "gp3"
  db_name                 = "proteaai"
  username                = var.rds_username
  password                = var.rds_password
  skip_final_snapshot     = false
  final_snapshot_identifier = "${var.app_name}-${var.environment}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  db_subnet_group_name    = aws_db_subnet_group.main[0].name
  vpc_security_group_ids  = [var.rds_security_group_id]
  publicly_accessible     = false
  multi_az                = false
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"
  enable_iam_database_authentication = true

  tags = {
    Name = "${var.app_name}-rds"
  }

  depends_on = [aws_db_subnet_group.main]
}

resource "aws_db_subnet_group" "main" {
  count           = var.database_type == "rds" ? 1 : 0
  name            = "${var.app_name}-db-subnet-group"
  subnet_ids      = var.private_subnet_ids
  tags = {
    Name = "${var.app_name}-db-subnet-group"
  }
}
