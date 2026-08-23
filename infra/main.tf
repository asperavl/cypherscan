terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# 1. Elastic Container Registry (ECR) to store our Docker image
resource "aws_ecr_repository" "app_repo" {
  name                 = var.app_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# 2. IAM Role for App Runner to pull images from ECR
resource "aws_iam_role" "apprunner_access_role" {
  name = "${var.app_name}-apprunner-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "build.apprunner.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr_access" {
  role       = aws_iam_role.apprunner_access_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# 3. AWS App Runner Service (Serverless Containers)
resource "aws_apprunner_service" "app_service" {
  service_name = var.app_name

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_access_role.arn
    }
    
    # Note: In a real deployment, you'd push the image to ECR first, 
    # then App Runner would deploy it. For this portfolio example, 
    # we point to the latest tag.
    image_repository {
      image_configuration {
        port = "3000"
        runtime_environment_variables = {
          NODE_ENV                 = "production"
          HENRIK_API_KEY           = var.henrik_api_key
          UPSTASH_REDIS_REST_URL   = var.upstash_redis_url
          UPSTASH_REDIS_REST_TOKEN = var.upstash_redis_token
        }
      }
      image_identifier      = "${aws_ecr_repository.app_repo.repository_url}:latest"
      image_repository_type = "ECR"
    }
  }

  network_configuration {
    egress_configuration {
      egress_type = "DEFAULT"
    }
  }

  instance_configuration {
    cpu    = "1 vCPU"
    memory = "2 GB"
  }
}
