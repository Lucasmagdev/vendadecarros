#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/autocrm-ia}"
REPOSITORY="https://github.com/Lucasmagdev/vendadecarros.git"

if [ ! -d "$APP_DIR/.git" ]; then
  mkdir -p "$APP_DIR"
  git clone "$REPOSITORY" "$APP_DIR"
fi

cd "$APP_DIR"
git pull --ff-only origin main

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Configure $APP_DIR/.env antes de iniciar o container."
  exit 1
fi

docker compose up -d --build --remove-orphans
docker compose ps
