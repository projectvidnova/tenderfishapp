output "vps_public_ip" {
  description = "Public IP of the application server"
  value       = ionoscloud_server.app.primary_ip
}

output "database_host" {
  description = "PostgreSQL cluster DNS name"
  value       = ionoscloud_pg_cluster.main.dns_name
}

output "database_url" {
  description = "Full PostgreSQL connection string"
  value       = "postgresql://${var.pg_admin_username}:${var.pg_admin_password}@${ionoscloud_pg_cluster.main.dns_name}:5432/${var.pg_db_name}?sslmode=require"
  sensitive   = true
}

output "database_private_ip" {
  description = "Private IP used for DB connection"
  value       = "192.168.1.10"
}

output "s3_bucket" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.files.bucket
}

output "s3_endpoint" {
  description = "S3 endpoint URL"
  value       = var.s3_endpoint
}

output "ssh_command" {
  description = "SSH into the VPS"
  value       = "ssh tenderfish@${ionoscloud_server.app.primary_ip}"
}
