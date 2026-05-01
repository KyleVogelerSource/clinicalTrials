aws_region   = "us-east-1"
github_owner = "KyleVogelerSource"
github_repo  = "clinicalTrials"

db_username = "app_user"
db_password = "change-me-please"
db_ssl      = true
db_ssl_reject_unauthorized = false

cloudfront_aliases = [
  "cardinaltrials.com",
  "www.cardinaltrials.com"
]
cloudfront_acm_certificate_arn = "arn:aws:acm:us-east-1:889474144721:certificate/3da130f8-4f72-41d9-be69-7c9e196684c4"
