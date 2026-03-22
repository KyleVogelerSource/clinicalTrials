output "vpc_id" {
  value = aws_vpc.this.id
}

output "private_subnet_ids" {
  value = [for s in aws_subnet.private : s.id]
}

output "public_subnet_ids" {
  value = [for s in aws_subnet.public : s.id]
}

output "apprunner_security_group_id" {
  value = aws_security_group.apprunner.id
}

output "db_security_group_id" {
  value = aws_security_group.db.id
}