variable "app_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "retention_in_days" {
  type    = number
  default = 7
}

output "log_group_name" {
  value = aws_cloudwatch_log_group.ecs_tasks.name
}

output "log_group_arn" {
  value = aws_cloudwatch_log_group.ecs_tasks.arn
}

resource "aws_cloudwatch_log_group" "ecs_tasks" {
  name              = "/ecs/${var.app_name}-${var.environment}"
  retention_in_days = var.retention_in_days

  tags = {
    Name = "${var.app_name}-ecs-logs"
  }
}

resource "aws_cloudwatch_log_stream" "app" {
  name           = "${var.app_name}-app"
  log_group_name = aws_cloudwatch_log_group.ecs_tasks.name
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "ecs_cpu_utilization" {
  alarm_name          = "${var.app_name}-${var.environment}-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80

  dimensions = {
    ServiceName = "${var.app_name}-service"
    ClusterName = "${var.app_name}-${var.environment}-cluster"
  }

  tags = {
    Name = "${var.app_name}-cpu-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory_utilization" {
  alarm_name          = "${var.app_name}-${var.environment}-memory-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80

  dimensions = {
    ServiceName = "${var.app_name}-service"
    ClusterName = "${var.app_name}-${var.environment}-cluster"
  }

  tags = {
    Name = "${var.app_name}-memory-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "unhealthy_host_count" {
  alarm_name          = "${var.app_name}-${var.environment}-unhealthy-hosts"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Average"
  threshold           = 0

  tags = {
    Name = "${var.app_name}-unhealthy-hosts-alarm"
  }
}
