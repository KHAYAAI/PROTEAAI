output "ecr_repository_url" {
  description = "ECR repository URL — use this to tag and push your Docker image"
  value       = module.ecr.repository_url
}

output "docker_build_and_push_commands" {
  description = "Commands to build and push Docker image to ECR"
  value       = <<-EOT
    aws ecr get-login-password --region ${var.region} | docker login --username AWS --password-stdin ${module.ecr.registry_id}.dkr.ecr.${var.region}.amazonaws.com
    docker build -t ${var.app_name} .
    docker tag ${var.app_name}:latest ${module.ecr.repository_url}:latest
    docker push ${module.ecr.repository_url}:latest
  EOT
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.alb.alb_dns_name
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = module.alb.alb_arn
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = module.ecs.service_name
}

output "ecs_task_definition_arn" {
  description = "ECS task definition ARN"
  value       = module.ecs.task_definition_arn
}

output "cloudwatch_log_group_name" {
  description = "CloudWatch log group name"
  value       = module.cloudwatch.log_group_name
}

output "database_type" {
  description = "Database type (efs or rds)"
  value       = var.database_type
}

output "efs_id" {
  description = "EFS file system ID (if using EFS)"
  value       = var.database_type == "efs" ? module.database.efs_id : null
}

output "rds_endpoint" {
  description = "RDS endpoint (if using RDS)"
  value       = var.database_type == "rds" ? module.database.rds_endpoint : null
}

output "rds_database_name" {
  description = "RDS database name"
  value       = var.database_type == "rds" ? module.database.rds_database_name : null
}

output "deployment_url" {
  description = "Application URL (update DNS to point ALB to your domain)"
  value       = "https://${var.domain_name}"
}

output "alb_health_check_endpoint" {
  description = "ALB health check endpoint"
  value       = "http://${module.alb.alb_dns_name}:${var.container_port}/health"
}

output "cloudwatch_log_command" {
  description = "Command to view logs in CloudWatch"
  value       = "aws logs tail /ecs/${var.app_name}-${var.environment} --follow"
}
