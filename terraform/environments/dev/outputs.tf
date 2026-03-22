output "backend_service_url" {
  value = module.apprunner_backend.service_url
}

output "backend_service_arn" {
  value = module.apprunner_backend.service_arn
}

output "frontend_bucket_name" {
  value = module.static_frontend.bucket_name
}

output "cloudfront_distribution_id" {
  value = module.static_frontend.distribution_id
}

output "cloudfront_domain_name" {
  value = module.static_frontend.domain_name
}

output "ecr_repository_url" {
  value = module.ecr.repository_url
}

output "github_actions_role_arn" {
  value = module.iam_github_oidc.github_actions_role_arn
}

output "db_address" {
  value = module.rds_postgres.db_address
}