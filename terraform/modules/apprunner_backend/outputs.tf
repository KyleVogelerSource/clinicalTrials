output "service_url" {
  value = "https://${aws_apprunner_service.this.service_url}"
}

output "service_arn" {
  value = aws_apprunner_service.this.arn
}