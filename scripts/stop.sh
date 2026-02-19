#!/bin/bash
set -e

echo "=== Stopping Workspace Hub ==="

# Stop all PM2 processes
echo "Stopping dev servers..."
pm2 delete all 2>/dev/null || true

# Stop Caddy
echo "Stopping Caddy..."
sudo systemctl stop caddy 2>/dev/null || sudo pkill caddy || true

echo ""
echo "=== Workspace Hub Stopped ==="
