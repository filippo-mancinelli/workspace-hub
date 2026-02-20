#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/config/projects.json"

echo "=== Starting Workspace Hub ==="

# Check config exists
if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: config/projects.json not found"
  echo "Copy config/projects.example.json to config/projects.json and configure your projects"
  exit 1
fi

# Read settings from config
DASHBOARD_PORT=$(node -e "
const config = require('$CONFIG_FILE');
console.log(config.settings?.dashboardPort || 9000);
")

# Generate Caddy configs
echo "Generating Caddy configurations..."
"$SCRIPT_DIR/generate-caddy.sh"

# Start all projects via PM2
echo "Starting dev servers..."
"$SCRIPT_DIR/manage.sh" start-all

# Start dashboard
echo "Starting dashboard on port $DASHBOARD_PORT..."
cd "$PROJECT_ROOT/dashboard"
pm2 delete workspace-hub-dashboard 2>/dev/null || true
DASHBOARD_PORT="$DASHBOARD_PORT" pm2 start server.js --name "workspace-hub-dashboard"

# Save PM2 processes
pm2 save

echo ""
echo "=== Workspace Hub Started ==="
echo ""
pm2 list
echo ""
echo "Dashboard: Check config/projects.json for dashboardDomain"
echo "Manage: ./scripts/manage.sh list"
echo ""
