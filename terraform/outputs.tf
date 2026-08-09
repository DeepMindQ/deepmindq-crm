# ═══════════════════════════════════════════════════
# DeepMindQ — Terraform Outputs
# ═══════════════════════════════════════════════════

output "db_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.main.endpoint
}

output "db_name" {
  description = "Database name"
  value       = aws_db_instance.main.db_name
}

output "db_port" {
  description = "Database port"
  value       = aws_db_instance.main.port
}

output "app_url" {
  description = "Application load balancer DNS name (use with HTTPS)"
  value       = "https://${aws_lb.app.dns_name}"
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = aws_lb.app.dns_name
}

output "alb_zone_id" {
  description = "ALB hosted zone ID for Route 53 alias records"
  value       = aws_lb.app.zone_id
}

output "s3_backup_bucket" {
  description = "S3 bucket name for backups"
  value       = aws_s3_bucket.backups.id
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.app.name
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.app.name
}

output "sns_alerts_topic_arn" {
  description = "SNS topic ARN for alerts"
  value       = aws_sns_topic.alerts.arn
}

output "ssm_nextauth_secret_name" {
  description = "SSM Parameter Store path for NextAuth secret"
  value       = aws_ssm_parameter.nextauth_secret.name
}

output "ssm_database_url_name" {
  description = "SSM Parameter Store path for database URL"
  value       = aws_ssm_parameter.database_url.name
}
