#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/config/projects.json"

echo "Generating Traefik configurations..."

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: config/projects.json not found"
  exit 1
fi

# Get Docker gateway IP for host access from containers
HOST_IP=$(ip addr show docker0 2>/dev/null | grep -oP 'inet \K[\d.]+' || echo "172.17.0.1")
echo "Host IP for Docker: $HOST_IP"

# Generate Traefik configs using Node.js
node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));
const settings = config.settings || {};
const traefikDir = settings.traefikDynamicDir || '/etc/dokploy/traefik/dynamic';
const dashboardPort = settings.dashboardPort || 9000;
const dashboardDomain = settings.dashboardDomain;
const hostIp = '$HOST_IP';

// Generate a unique ID for router/service names
const generateId = () => Math.random().toString(36).substring(2, 8);

// Remove old workspace-hub configs first
const existingFiles = fs.readdirSync(traefikDir).filter(f => f.startsWith('workspace-hub-'));
existingFiles.forEach(f => {
  try {
    fs.unlinkSync(\`\${traefikDir}/\${f}\`);
    console.log('Removed old config:', f);
  } catch (e) {}
});

// Generate config for each project
config.projects.forEach(p => {
  if (p.enabled !== false && p.domain && p.port) {
    const id = generateId();
    const safeName = p.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const configFile = \`\${traefikDir}/workspace-hub-\${safeName}-\${id}.yml\`;
    
    const yaml = \`http:
  routers:
    \${safeName}-\${id}-router:
      rule: Host(\\\`\${p.domain}\\\`)
      service: \${safeName}-\${id}-service
      middlewares:
        - redirect-to-https
      entryPoints:
        - web
    \${safeName}-\${id}-router-websecure:
      rule: Host(\\\`\${p.domain}\\\`)
      service: \${safeName}-\${id}-service
      middlewares: []
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
  services:
    \${safeName}-\${id}-service:
      loadBalancer:
        servers:
          - url: http://\${hostIp}:\${p.port}
        passHostHeader: true
\`;
    
    fs.writeFileSync(configFile, yaml);
    console.log('Created:', configFile);
  }
});

// Dashboard config
if (dashboardDomain) {
  const id = generateId();
  const configFile = \`\${traefikDir}/workspace-hub-dashboard-\${id}.yml\`;
  
  const yaml = \`http:
  routers:
    workspace-hub-dashboard-\${id}-router:
      rule: Host(\\\`\${dashboardDomain}\\\`)
      service: workspace-hub-dashboard-\${id}-service
      middlewares:
        - redirect-to-https
      entryPoints:
        - web
    workspace-hub-dashboard-\${id}-router-websecure:
      rule: Host(\\\`\${dashboardDomain}\\\`)
      service: workspace-hub-dashboard-\${id}-service
      middlewares: []
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
  services:
    workspace-hub-dashboard-\${id}-service:
      loadBalancer:
        servers:
          - url: http://\${hostIp}:\${dashboardPort}
        passHostHeader: true
\`;
  
  fs.writeFileSync(configFile, yaml);
  console.log('Created:', configFile);
}
"

echo ""
echo "Traefik configs generated. Traefik will auto-reload."
echo ""
