locals {
  name_prefix = "${var.project_name}-${var.env_name}"
}

resource "aws_db_subnet_group" "this" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = var.private_subnet_ids
  tags       = merge(var.tags, { Name = "${local.name_prefix}-db-subnet-group" })
}

resource "aws_db_instance" "this" {
  identifier              = "${local.name_prefix}-postgres"
  engine                  = "postgres"
  engine_version          = "16.3"
  instance_class          = var.instance_class
  allocated_storage       = var.allocated_storage
  db_name                 = var.db_name
  username                = var.db_username
  password                = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.this.name
  vpc_security_group_ids  = [var.db_security_group_id]
  publicly_accessible     = false
  skip_final_snapshot     = true
  backup_retention_period = 7
  multi_az                = false
  storage_encrypted       = true
  deletion_protection     = false

  tags = merge(var.tags, { Name = "${local.name_prefix}-postgres" })
}