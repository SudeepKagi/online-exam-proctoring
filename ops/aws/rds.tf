# ─────────────────────────────────────────────────────────────
# RDS PostgreSQL Instance (Free-Tier db.t3.micro Option)
# ─────────────────────────────────────────────────────────────

resource "aws_db_instance" "postgres" {
  count                 = var.enable_rds ? 1 : 0
  identifier            = "${var.project_name}-db"
  engine                = "postgres"
  engine_version        = "15.7"
  instance_class        = "db.t3.micro"
  allocated_storage     = 20
  max_allocated_storage = 50
  storage_type          = "gp3"
  storage_encrypted     = true
  publicly_accessible   = false

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.db_subnet_group.name
  vpc_security_group_ids = [aws_security_group.rds[0].id]

  # Backup & Maintenance Configuration
  backup_retention_period    = 7
  backup_window              = "03:00-04:00"
  maintenance_window         = "Mon:04:00-Mon:05:00"
  auto_minor_version_upgrade = true
  copy_tags_to_snapshot      = true
  deletion_protection        = false
  skip_final_snapshot        = true

  tags = {
    Name = "${var.project_name}-rds"
  }
}
