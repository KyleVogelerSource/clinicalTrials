variable "project_name" { type = string }
variable "env_name" { type = string }
variable "tags" { type = map(string) }

variable "cloudfront_aliases" {
  type    = list(string)
  default = []
}

variable "cloudfront_acm_certificate_arn" {
  type    = string
  default = null
}
