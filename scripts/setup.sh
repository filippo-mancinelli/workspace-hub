#!/bin/bash
set -e

echo "=== Workspace Hub Setup ==="

# Check for root
if [ "$EUID" -eq 0 ]; then
  echo "Please run without sudo"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Detect OS
if [ -f /etc/debian_version ]; then
  PKG_MANAGER="apt"
elif [ -f /etc/redhat-release ]; then
  PKG_MANAGER="yum"
else
  echo "Unsupported OS. Please install dependencies manually."
  exit 1
fi

echo ""
echo "Checking dependencies..."

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "Node.js not found. Please install Node.js 18+ first."
  echo "Example: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
  exit 1
else
  echo "Node.js: $(node --version)"
fi

# Install PM2 globally
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2..."
  npm install -g pm2
else
  echo "PM2: $(pm2 --version)"
fi

# Install Caddy
if ! command -v caddy &> /dev/null; then
  echo "Installing Caddy..."
  if [ "$PKG_MANAGER" = "apt" ]; then
    sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo apt update
    sudo apt install -y caddy
  elif [ "$PKG_MANAGER" = "yum" ]; then
    sudo yum install -y yum-plugin-coreos
    sudo yum-config-manager --add-repo https://download.caddyserver.com/rpm/caddy.repo
    sudo yum install -y caddy
  fi
else
  echo "Caddy: $(caddy version)"
fi

# Create log directory
echo "Creating log directory..."
sudo mkdir -p /var/log/workspace-hub 2>/dev/null || mkdir -p "$PROJECT_ROOT/logs"
sudo chown $USER:$USER /var/log/workspace-hub 2>/dev/null || true

# Create config if not exists
if [ ! -f "$PROJECT_ROOT/config/projects.json" ]; then
  echo "Creating projects config..."
  cp "$PROJECT_ROOT/config/projects.example.json" "$PROJECT_ROOT/config/projects.json"
  echo ""
  echo "IMPORTANT: Edit $PROJECT_ROOT/config/projects.json with your projects!"
fi

# Install dashboard dependencies
echo "Installing dashboard dependencies..."
cd "$PROJECT_ROOT/dashboard"
npm install

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Edit config/projects.json with your projects"
echo "2. Make sure domains are pointing to this VPS"
echo "3. Run ./scripts/start.sh to start all services"
echo "4. Access dashboard at the configured domain"
echo ""
