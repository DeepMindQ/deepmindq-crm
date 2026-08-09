variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (production, staging, dev)"
  type        = string
  default     = "production"
}

variable "db_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

variable "nextauth_secret" {
  description = "NextAuth.js secret key for session encryption"
  type        = string
  sensitive   = true
}

variable "ecr_repository_url" {
  description = "ECR repository URL for Docker images"
  type        = string
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_storage_gb" {
  description = "RDS storage in GB"
  type        = number
  default     = 50
}

variable "app_instance_count" {
  description = "Number of ECS Fargate tasks"
  type        = number
  default     = 2
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for HTTPS termination"
  type        = string
  default     = ""
}

variable "alerts_email" {
  description = "Email address for CloudWatch alarm notifications"
  type        = string
  default     = "ops@deepmindq.com"
}
