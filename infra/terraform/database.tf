# ──────────────────────────────────────────────
# Managed PostgreSQL Cluster
# ──────────────────────────────────────────────
resource "ionoscloud_pg_cluster" "main" {
  display_name         = "${var.project_name}-${var.environment}"
  postgres_version     = var.pg_version
  location             = var.location
  instances            = var.pg_instances
  cores                = var.pg_cores
  ram                  = var.pg_ram_mb
  storage_size         = var.pg_storage_gb * 1024 # MB
  storage_type         = "SSD"
  synchronization_mode = "ASYNCHRONOUS"

  depends_on = [ionoscloud_nic.private]

  credentials {
    username = var.pg_admin_username
    password = var.pg_admin_password
  }

  connections {
    datacenter_id = ionoscloud_datacenter.main.id
    lan_id        = ionoscloud_lan.private.id
    cidr          = "192.168.1.10/24"
  }

  maintenance_window {
    day_of_the_week = "Sunday"
    time            = "03:00:00"
  }
}

# ──────────────────────────────────────────────
# Database
# ──────────────────────────────────────────────
resource "ionoscloud_pg_database" "app" {
  cluster_id = ionoscloud_pg_cluster.main.id
  name       = var.pg_db_name
  owner      = var.pg_admin_username
}
