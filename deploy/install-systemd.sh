#!/bin/sh
set -eu

APP_DIR=/opt/autocrm-ia
DATA_DIR=/var/lib/autocrm
ENV_DIR=/etc/autocrm
CADDY_FILE=/etc/caddy/Caddyfile
CADDY_SNIPPET=/etc/caddy/conf.d/autocrm.caddy

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como root."
  exit 1
fi

if ! id autocrm >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "$DATA_DIR" --shell /usr/sbin/nologin autocrm
fi

install -d -o autocrm -g autocrm -m 0750 "$DATA_DIR"
install -d -o root -g autocrm -m 0750 "$ENV_DIR"
chown -R autocrm:autocrm "$APP_DIR"

cd "$APP_DIR"
runuser -u autocrm -- npm ci
runuser -u autocrm -- npm run build
runuser -u autocrm -- npm prune --omit=dev

install -o root -g root -m 0644 deploy/autocrm.service /etc/systemd/system/autocrm.service
systemctl daemon-reload

if command -v caddy >/dev/null 2>&1 && [ -f "$CADDY_FILE" ]; then
  backup="${CADDY_FILE}.backup.$(date +%Y%m%d%H%M%S)"
  cp "$CADDY_FILE" "$backup"
  install -d -o root -g root -m 0755 /etc/caddy/conf.d
  install -o root -g root -m 0644 deploy/Caddyfile.autocrm "$CADDY_SNIPPET"
  if ! grep -Fq 'import /etc/caddy/conf.d/*.caddy' "$CADDY_FILE"; then
    printf '\nimport /etc/caddy/conf.d/*.caddy\n' >> "$CADDY_FILE"
  fi
  if caddy validate --config "$CADDY_FILE"; then
    systemctl reload caddy
  else
    cp "$backup" "$CADDY_FILE"
    rm -f "$CADDY_SNIPPET"
    echo "Configuração do Caddy restaurada após falha de validação."
    exit 1
  fi
fi

echo "Instalação preparada. Configure $ENV_DIR/autocrm.env e inicie autocrm.service."
