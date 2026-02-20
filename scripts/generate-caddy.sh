#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/config/projects.json"
TEMP_DIR="/tmp/workspace-hub-caddy"

echo "Generating Caddy configurations..."

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: config/projects.json not found"
  exit 1
fi

# Read settings for caddy directory
CADDY_DIR=$(node -e "const c=require('$CONFIG_FILE'); console.log(c.settings?.caddyConfigDir || '/etc/caddy/conf.d');")
echo "Caddy config directory: $CADDY_DIR"

# Create temp directory
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Generate Caddy configs using Node.js to temp dir
node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));
const settings = config.settings || {};
const tempDir = '$TEMP_DIR';
const dashboardPort = settings.dashboardPort || 9000;
const dashboardDomain = settings.dashboardDomain;

// Generate config for each project
config.projects.forEach(p => {
  if (p.enabled !== false && p.domain && p.port) {
    const safeName = p.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const configFile = \`\${tempDir}/workspace-hub-\${safeName}.caddyfile\`;
    
    const caddyConf = \`# Workspace Hub - \${p.name}
\${p.domain} {
    reverse_proxy 127.0.0.1:\${p.port}
    encode zstd gzip
    
    # Security headers
    header {
        X-Frame-Options \"SAMEORIGIN\"
        X-Content-Type-Options \"nosniff\"
        X-XSS-Protection \"1; mode=block\"
        Referrer-Policy \"strict-origin-when-cross-origin\"
    }
}
\`;
    
    fs.writeFileSync(configFile, caddyConf);
    console.log('Created:', \`workspace-hub-\${safeName}.caddyfile\`);
  }
});

// Dashboard config
if (dashboardDomain) {
  const configFile = \`\${tempDir}/workspace-hub-dashboard.caddyfile\`;
  
  const caddyConf = \`# Workspace Hub - Dashboard
\${dashboardDomain} {
    reverse_proxy 127.0.0.1:\${dashboardPort}
    encode zstd gzip
    
    # Security headers
    header {
        X-Frame-Options \"SAMEORIGIN\"
        X-Content-Type-Options \"nosniff\"
        X-XSS-Protection \"1; mode=block\"
        Referrer-Policy \"strict-origin-when-cross-origin\"
    }
}
\`;
  
  fs.writeFileSync(configFile, caddyConf);
  console.log('Created:', 'workspace-hub-dashboard.caddyfile');
}
"

# Remove old workspace-hub configs with sudo
echo "Removing old configs..."
sudo find "$CADDY_DIR" -name 'workspace-hub-*.caddyfile' -delete 2>/dev/null || true

# Copy new configs with sudo
echo "Installing new configs..."
sudo cp "$TEMP_DIR"/*.caddyfile "$CADDY_DIR/" 2>/dev/null || echo "No configs generated"

# Cleanup
rm -rf "$TEMP_DIR"

# Reload Caddy
echo "Reloading Caddy..."
sudo systemctl reload caddy || echo "Caddy reload failed - you may need to reload manually"

echo ""
echo "Caddy configs installed and reloaded."
echo ""
