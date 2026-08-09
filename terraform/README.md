# DeepMindQ — Terraform Infrastructure as Code

AWS infrastructure for the DeepMindQ Intelligence OS platform.

## Architecture

- **VPC** — 10.0.0.0/16 with 2 private + 2 public subnets across availability zones
- **Database** — Amazon RDS PostgreSQL 16 (encrypted, Performance Insights enabled)
- **Compute** — ECS Fargate with auto-scaling (CPU + memory target tracking)
- **Load Balancer** — Application Load Balancer with HTTPS redirect and SSL termination
- **Storage** — S3 bucket for backups (versioned, encrypted, 90-day lifecycle)
- **Secrets** — AWS SSM Parameter Store for sensitive configuration
- **Monitoring** — CloudWatch alarms for CPU, memory, and DB connections with SNS alerts
- **Networking** — NAT Gateways for private subnet egress, Internet Gateway for public

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/downloads) >= 1.5
- AWS CLI configured with appropriate credentials
- An ECR repository with the DeepMindQ Docker image pushed
- An ACM certificate (for production HTTPS)

## Quick Start

```bash
# Navigate to terraform directory
cd terraform

# Initialize Terraform (download providers, configure backend)
terraform init

# Review the execution plan
terraform plan

# Apply the configuration
terraform apply
```

## Configuration

### Environment Variables

Sensitive values can be passed via environment variables:

```bash
export TF_VAR_db_password="your-secure-password"
export TF_VAR_nextauth_secret="your-nextauth-secret"
export TF_VAR_ecr_repository_url="123456789.dkr.ecr.us-east-1.amazonaws.com/deepmindq"
export TF_VAR_acm_certificate_arn="arn:aws:acm:us-east-1:123456789:certificate/xxx"
```

### Variable File

Or create a `terraform.tfvars` file:

```hcl
db_password           = "your-secure-password"
nextauth_secret        = "your-nextauth-secret"
ecr_repository_url     = "123456789.dkr.ecr.us-east-1.amazonaws.com/deepmindq"
acm_certificate_arn    = "arn:aws:acm:us-east-1:123456789:certificate/xxx"
alerts_email           = "ops@yourcompany.com"
```

> **Never commit `terraform.tfvars` to version control.** Add it to `.gitignore`.

## Environments

Deploy to different environments by overriding variables:

```bash
# Staging (smaller instance, no final snapshot)
terraform apply -var="environment=staging" -var="db_instance_class=db.t3.small" -var="db_storage_gb=20"

# Production (default values)
terraform apply -var="environment=production"
```

## Outputs

After `terraform apply`, key outputs are displayed:

| Output | Description |
|--------|-------------|
| `db_endpoint` | RDS PostgreSQL connection endpoint |
| `app_url` | HTTPS URL for the application |
| `alb_dns_name` | Load balancer DNS name |
| `s3_backup_bucket` | S3 bucket for database backups |
| `ecs_cluster_name` | ECS cluster name |
| `vpc_id` | VPC identifier |

## Common Operations

```bash
# View current state
terraform show

# Destroy all resources (use with caution)
terraform destroy

# Import existing resources
terraform import aws_db_instance.main deepmindq-production

# Format configuration filesterraform fmt

# Validate configuration
terraform validate
```

## Monitoring

CloudWatch alarms are configured for:
- **High CPU** (>80% for 5 minutes) — triggers SNS alert
- **High Memory** (>85% for 5 minutes) — triggers SNS alert
- **DB Connections** (>80 for 5 minutes) — triggers SNS alert

View logs:

```bash
aws logs tail /ecs/deepmindq-production --follow
```

## Cost Estimation

```bash
# Estimate costs before applying
terraform plan -out=tfplan
curl -s https://raw.githubusercontent.com/hashicorp/infracost/master/scripts/install.sh | bash
infracost breakdown --path tfplan
```

## Security Notes

- RDS storage is encrypted at rest (AES-256)
- S3 backups use KMS encryption with public access blocked
- Database credentials are stored in SSM Parameter Store (SecureString)
- ECS tasks use minimal IAM roles
- ALB enforces HTTPS with automatic HTTP→HTTPS redirect

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Backend configuration changed` | Run `terraform init -migrate-state` |
| `Insufficient permissions` | Check AWS IAM policies for the user/role |
| `DB subnet group` | Ensure private subnets exist before creating RDS |
| `ACM certificate not found` | Certificate must be in `us-east-1` for ALB |
