locals {
  name_prefix = "${var.project_name}-${var.env_name}"
  tags = {
    Project     = var.project_name
    Environment = var.env_name
    ManagedBy   = "terraform"
  }
}

module "network" {
  source = "../../modules/network"

  project_name = var.project_name
  env_name     = var.env_name
  vpc_cidr     = "10.0.0.0/16"

  public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnet_cidrs = ["10.0.11.0/24", "10.0.12.0/24"]

  tags = local.tags
}

module "rds_postgres" {
  source = "../../modules/rds_postgres"

  project_name         = var.project_name
  env_name             = var.env_name
  db_name              = var.db_name
  db_username          = var.db_username
  db_password          = var.db_password
  private_subnet_ids   = module.network.private_subnet_ids
  vpc_id               = module.network.vpc_id
  db_security_group_id = module.network.db_security_group_id
  instance_class       = "db.t4g.micro"
  allocated_storage    = 20
  tags                 = local.tags
}

module "ecr" {
  source = "../../modules/ecr"

  repository_name = "${local.name_prefix}-backend"
  tags            = local.tags
}

module "apprunner_backend" {
  source = "../../modules/apprunner_backend"

  project_name                  = var.project_name
  env_name                      = var.env_name
  service_name                  = "${local.name_prefix}-backend"
  ecr_repository_url            = module.ecr.repository_url
  image_tag                     = var.backend_image_tag
  backend_port                  = var.backend_port
  vpc_connector_subnet_ids      = module.network.private_subnet_ids
  vpc_connector_security_groups = [module.network.apprunner_security_group_id]

  environment_variables = {
    NODE_ENV    = "production"
    PORT        = tostring(var.backend_port)
    DB_HOST     = module.rds_postgres.db_address
    DB_PORT     = "5432"
    DB_NAME     = var.db_name
    DB_USER     = var.db_username
    DB_PASSWORD = var.db_password
    DB_SSL      = var.db_ssl ? "true" : "false"
    DB_SSL_REJECT_UNAUTHORIZED = var.db_ssl_reject_unauthorized ? "true" : "false"
    LOG_LEVEL   = "info"
  }

  tags = local.tags
}

module "static_frontend" {
  source = "../../modules/static_frontend"

  project_name                     = var.project_name
  env_name                         = var.env_name
  cloudfront_aliases               = var.cloudfront_aliases
  cloudfront_acm_certificate_arn   = var.cloudfront_acm_certificate_arn
  tags                             = local.tags
}

module "iam_github_oidc" {
  source = "../../modules/iam_github_oidc"

  project_name                  = var.project_name
  env_name                      = var.env_name
  github_owner                  = var.github_owner
  github_repo                   = var.github_repo
  ecr_repository_arn            = module.ecr.repository_arn
  apprunner_service_arn         = module.apprunner_backend.service_arn
  apprunner_ecr_access_role_arn = module.apprunner_backend.ecr_access_role_arn
  s3_bucket_arn                 = module.static_frontend.bucket_arn
  cloudfront_dist_arn           = module.static_frontend.distribution_arn
  tags                          = local.tags
}
