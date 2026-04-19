# ──────────────────────────────────────────────
# Datacenter & Networking
# ──────────────────────────────────────────────
resource "ionoscloud_datacenter" "main" {
  name     = "${var.project_name}-${var.environment}"
  location = var.location
}

resource "ionoscloud_lan" "public" {
  datacenter_id = ionoscloud_datacenter.main.id
  name          = "${var.project_name}-public"
  public        = true
}

resource "ionoscloud_lan" "private" {
  datacenter_id = ionoscloud_datacenter.main.id
  name          = "${var.project_name}-private"
  public        = false
}

# ──────────────────────────────────────────────
# VPS (Cloud Server)
# ──────────────────────────────────────────────
resource "ionoscloud_server" "app" {
  datacenter_id  = ionoscloud_datacenter.main.id
  name           = "${var.project_name}-app"
  cores          = var.server_cores
  ram            = var.server_ram_mb
  image_name     = var.server_image
  image_password = random_password.server_password.result
  ssh_keys       = [var.ssh_public_key]
  type           = "ENTERPRISE"

  volume {
    name      = "${var.project_name}-boot"
    size      = var.server_disk_gb
    disk_type = "SSD Standard"
    user_data = base64encode(templatefile("${path.module}/cloud-init.yml", {
      ssh_public_key = var.ssh_public_key
      project_name   = var.project_name
      domain         = var.domain
      github_repo    = var.github_repo
    }))
  }

  nic {
    name   = "${var.project_name}-nic"
    lan    = ionoscloud_lan.public.id
    dhcp   = true
  }

  lifecycle {
    ignore_changes = [volume[0].user_data]
  }
}

# Private NIC for database connectivity
resource "ionoscloud_nic" "private" {
  datacenter_id = ionoscloud_datacenter.main.id
  server_id     = ionoscloud_server.app.id
  lan           = ionoscloud_lan.private.id
  name          = "${var.project_name}-nic-private"
  dhcp          = false
  ips           = ["192.168.1.11"]
}

resource "random_password" "server_password" {
  length  = 16
  special = false
}

# ──────────────────────────────────────────────
# Firewall Rules
# ──────────────────────────────────────────────
resource "ionoscloud_firewall" "ssh" {
  datacenter_id    = ionoscloud_datacenter.main.id
  server_id        = ionoscloud_server.app.id
  nic_id           = ionoscloud_server.app.primary_nic
  protocol         = "TCP"
  name             = "Allow SSH"
  port_range_start = 22
  port_range_end   = 22
}

resource "ionoscloud_firewall" "http" {
  datacenter_id    = ionoscloud_datacenter.main.id
  server_id        = ionoscloud_server.app.id
  nic_id           = ionoscloud_server.app.primary_nic
  protocol         = "TCP"
  name             = "Allow HTTP"
  port_range_start = 80
  port_range_end   = 80
}

resource "ionoscloud_firewall" "https" {
  datacenter_id    = ionoscloud_datacenter.main.id
  server_id        = ionoscloud_server.app.id
  nic_id           = ionoscloud_server.app.primary_nic
  protocol         = "TCP"
  name             = "Allow HTTPS"
  port_range_start = 443
  port_range_end   = 443
}
