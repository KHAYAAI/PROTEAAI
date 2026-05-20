variable "app_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

variable "container_image" {
  type = string
}

variable "container_port" {
  type = number
}

variable "ecs_cpu" {
  type = number
}

variable "ecs_memory" {
  type = number
}

variable "ecs_min_capacity" {
  type = number
}

variable "ecs_max_capacity" {
  type = number
}

variable "ecs_target_cpu_utilization" {
  type = number
}

variable "ecs_target_memory_utilization" {
  type = number
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "ecs_security_group_id" {
  type = string
}

variable "alb_target_group_arn" {
  type = string
}

variable "log_group_name" {
  type = string
}

variable "ecs_task_execution_role_arn" {
  type = string
}

variable "ecs_task_role_arn" {
  type = string
}

variable "secrets_arns" {
  type = list(string)
}

variable "database_type" {
  type = string
}

variable "efs_id" {
  type    = string
  default = null
}

variable "rds_endpoint" {
  type    = string
  default = null
}

variable "environment_variables" {
  type    = list(map(string))
  default = []
}

output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  value = aws_ecs_cluster.main.arn
}

output "service_name" {
  value = aws_ecs_service.main.name
}

output "task_definition_arn" {
  value = aws_ecs_task_definition.main.arn
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.app_name}-${var.environment}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.app_name}-cluster"
  }
}

# CloudWatch Log Group reference (created in cloudwatch module)
data "aws_cloudwatch_log_group" "ecs_logs" {
  name = var.log_group_name
}

# ECS Task Definition
resource "aws_ecs_task_definition" "main" {
  family                   = "${var.app_name}-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ecs_cpu
  memory                   = var.ecs_memory
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name      = var.app_name
      image     = var.container_image
      essential = true
      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = var.log_group_name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "ecs"
        }
      }
      environment = concat(
        [
          {
            name  = "NODE_ENV"
            value = var.environment == "prod" ? "production" : "staging"
          },
          {
            name  = "PORT"
            value = tostring(var.container_port)
          },
          {
            name  = "PROTEAAI_DATA_DIR"
            value = var.database_type == "efs" ? "/data" : "/tmp"
          }
        ],
        var.environment_variables
      )
      secrets = [
        for secret_arn in var.secrets_arns : {
          name      = split("/", secret_arn)[length(split("/", secret_arn)) - 1]
          valueFrom = secret_arn
        }
      ]
      mountPoints = var.database_type == "efs" ? [
        {
          sourceVolume  = "efs-storage"
          containerPath = "/data"
          readOnly      = false
        }
      ] : []
    }
  ])

  dynamic "volume" {
    for_each = var.database_type == "efs" ? [1] : []
    content {
      name = "efs-storage"
      efs_volume_configuration {
        file_system_id = var.efs_id
      }
    }
  }

  tags = {
    Name = "${var.app_name}-task-definition"
  }
}

# ECS Service
resource "aws_ecs_service" "main" {
  name            = "${var.app_name}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.main.arn
  desired_count   = var.ecs_min_capacity
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.alb_target_group_arn
    container_name   = var.app_name
    container_port   = var.container_port
  }

  depends_on = [
    aws_ecs_task_definition.main
  ]

  tags = {
    Name = "${var.app_name}-service"
  }
}

# Auto-scaling target
resource "aws_appautoscaling_target" "ecs_target" {
  max_capacity       = var.ecs_max_capacity
  min_capacity       = var.ecs_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.main.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# CPU-based auto-scaling
resource "aws_appautoscaling_policy" "ecs_policy_cpu" {
  name               = "${var.app_name}-cpu-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = var.ecs_target_cpu_utilization / 100.0
  }
}

# Memory-based auto-scaling
resource "aws_appautoscaling_policy" "ecs_policy_memory" {
  name               = "${var.app_name}-memory-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value = var.ecs_target_memory_utilization / 100.0
  }
}
