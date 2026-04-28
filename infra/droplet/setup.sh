#!/usr/bin/env bash
# One-time droplet provisioning script.
# Run as root on a fresh Ubuntu 24.04 droplet:
#   curl -fsSL https://raw.githubusercontent.com/anthonychu-spec/go24-mobile/main/infra/droplet/setup.sh | sudo bash

set -euo pipefail

# Force non-interactive apt — never prompt for config conflicts.
# Always keep currently-installed config files.
export DEBIAN_FRONTEND=noninteractive
APT_OPTS="-o Dpkg::Options::=--force-confold -o Dpkg::Options::=--force-confdef"

echo "=== GO24 droplet provisioning ==="

# --- 1. System update + basics ---
apt-get update -y
apt-get -y $APT_OPTS upgrade
apt-get -y $APT_OPTS install \
  curl wget git ufw fail2ban htop vim \
  ca-certificates gnupg lsb-release unattended-upgrades

# --- 2. Auto-security-updates ---
dpkg-reconfigure -p low unattended-upgrades || true

# --- 3. Firewall (allow SSH + HTTP/S only) ---
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# --- 4. Fail2ban for SSH brute force ---
systemctl enable --now fail2ban

# --- 5. Docker Engine + Compose plugin ---
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get -y $APT_OPTS install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# --- 6. Create deploy user ---
if ! id -u deploy >/dev/null 2>&1; then
  adduser --disabled-password --gecos '' deploy
  usermod -aG docker deploy
  echo "deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart go24, /usr/bin/docker, /usr/bin/docker-compose, /usr/local/bin/docker compose" >> /etc/sudoers
  mkdir -p /home/deploy/.ssh
  chmod 700 /home/deploy/.ssh
  cp /root/.ssh/authorized_keys /home/deploy/.ssh/
  chown -R deploy:deploy /home/deploy/.ssh
  chmod 600 /home/deploy/.ssh/authorized_keys
fi

# --- 7. Project dir ---
mkdir -p /opt/go24
chown deploy:deploy /opt/go24

# --- 8. SSH hardening ---
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload ssh

# --- 9. Swap (helpful for 4GB droplets running Postgres) ---
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# --- 10. Postgres backup cron skeleton (config later) ---
mkdir -p /opt/go24/backups
cat > /opt/go24/backup.sh <<'BACKUP'
#!/bin/bash
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)
docker exec go24-postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > /opt/go24/backups/db-$TS.sql.gz
# Keep last 30 days
find /opt/go24/backups -name 'db-*.sql.gz' -mtime +30 -delete
BACKUP
chmod +x /opt/go24/backup.sh
echo '0 3 * * * deploy /opt/go24/backup.sh >> /var/log/go24-backup.log 2>&1' > /etc/cron.d/go24-backup

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. cd /opt/go24"
echo "  2. sudo -u deploy git clone https://github.com/anthonychu-spec/go24-mobile.git ."
echo "  3. cp .env.example .env && nano .env  # fill PGM_*, POSTGRES_PASSWORD, JWT_SECRET, REDIS_PASSWORD, API_DOMAIN"
echo "  4. docker compose -f infra/droplet/docker-compose.prod.yml up -d --build"
echo "  5. Point Cloudflare DNS A record (or tunnel) to this droplet IP"
echo ""
echo "Logs:    docker compose -f infra/droplet/docker-compose.prod.yml logs -f api"
echo "Restart: docker compose -f infra/droplet/docker-compose.prod.yml restart api"
