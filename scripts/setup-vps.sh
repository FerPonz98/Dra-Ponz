#!/usr/bin/env bash
# Preparación única de un VPS Ubuntu (22.04/24.04) sin Docker. Ejecutar como root o con sudo.
#   sudo APP_USER=deploy ./scripts/setup-vps.sh
set -euo pipefail
APP_USER="${APP_USER:-deploy}"
APP_DIR="${APP_DIR:-/var/www/cobros}"
UPLOAD_DIR="${UPLOAD_DIR:-/var/data/uploads}"

echo "▶ Zona horaria America/La_Paz (los crons usan hora local)"
timedatectl set-timezone America/La_Paz

echo "▶ Paquetes"
apt-get update
apt-get install -y curl git nginx postgresql postgresql-contrib certbot python3-certbot-nginx ufw rclone fail2ban gnupg unattended-upgrades
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

echo "▶ PostgreSQL solo en localhost"
PGCONF="$(find /etc/postgresql -name postgresql.conf | head -1)"
sed -i "s/^#\?listen_addresses.*/listen_addresses = 'localhost'/" "$PGCONF"
systemctl restart postgresql

echo "▶ fail2ban (SSH y Nginx) y actualizaciones de seguridad automáticas"
cat > /etc/fail2ban/jail.d/cobros.local <<JAIL
[sshd]
enabled = true
maxretry = 5
bantime = 1h

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 20
findtime = 10m
bantime = 30m
JAIL
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "▶ Firewall: solo 22, 80 y 443"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "▶ Carpetas"
id "$APP_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$APP_USER"
mkdir -p "$APP_DIR" "$APP_DIR/logs" "$UPLOAD_DIR" /var/backups/cobros
chown -R "$APP_USER":"$APP_USER" "$APP_DIR" "$UPLOAD_DIR" /var/backups/cobros
chmod 750 "$UPLOAD_DIR" /var/backups/cobros
umask 077

echo "▶ PM2 al arranque"
env PATH="$PATH" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER"

cat <<EOF

Listo. Siguientes pasos (como $APP_USER):
  1. git clone <repo> $APP_DIR && cd $APP_DIR && cp .env.example .env  (y completar valores)
  2. npm ci && npm run db:setup && npm run db:migrate && npm run db:seed
  3. ./scripts/deploy.sh
  4. sudo cp scripts/nginx/julietaponz.com.conf /etc/nginx/sites-available/julietaponz.com
     sudo ln -s /etc/nginx/sites-available/julietaponz.com /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
  5. sudo certbot --nginx -d julietaponz.com -d www.julietaponz.com
  6. crontab scripts/crontab.txt
  7. rclone config   (crear el remoto y ponerlo en RCLONE_REMOTE del .env)
  8. Clave de backups: openssl rand -base64 32 > ~/.backup-clave && chmod 600 ~/.backup-clave
     y en .env: BACKUP_CLAVE_ARCHIVO=/home/$APP_USER/.backup-clave  (guárdala también fuera del VPS)
  9. SSH: entra con llave y luego en /etc/ssh/sshd_config pon PasswordAuthentication no y PermitRootLogin no
EOF
