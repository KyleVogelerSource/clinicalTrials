variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "clinicaltrials"
}

variable "env_name" {
  type    = string
  default = "dev"
}

variable "github_owner" {
  type = string
}

variable "github_repo" {
  type = string
}

variable "db_name" {
  type    = string
  default = "clinicaltrials"
}

variable "db_username" {
  type      = string
  sensitive = true
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "db_ssl" {
  type    = bool
  default = true
}

variable "db_ssl_reject_unauthorized" {
  type    = bool
  default = false
}

variable "backend_port" {
  type    = number
  default = 3000
}

variable "backend_image_tag" {
  type    = string
  default = "latest"
}

variable "cloudfront_aliases" {
  type    = list(string)
  default = []
}

variable "cloudfront_acm_certificate_arn" {
  type    = string
  default = null
}
