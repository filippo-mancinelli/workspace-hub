# Workspace Hub

A self-hosted development environment manager for remote development. Keep all your dev servers running with hot-reload, accessible via HTTPS from anywhere - even from your phone via SSH.

## Features

- **Persistent Dev Servers**: Auto-start and keep dev servers running with hot-reload
- **HTTPS Access**: Secure URLs for each project via Traefik reverse proxy (Dokploy compatible)
- **Dashboard**: Web UI to monitor and control all dev servers
- **SSH Ready**: Develop remotely from any device, including phone
- **Open Source**: Self-host on any VPS (Hetzner, DigitalOcean, etc.)

## Quick Start

### Prerequisites

- Linux VPS (Ubuntu/Debian recommended)
- **Dokploy** already installed (recommended) OR Traefik standalone
- Domain name pointing to your VPS
- Node.js 18+
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/workspace-hub.git
cd workspace-hub

# Run setup script (installs PM2, configures Traefik integration)
./scripts/setup.sh

# Configure your projects
cp config/projects.example.json config/projects.json
# Edit config/projects.json with your projects

# Start the hub
./scripts/start.sh
```

### Configuration

Edit `config/projects.json` to define your projects:

```json
{
  "projects": [
    {
      "name": "my-backend",
      "path": "/home/user/dev/my-backend",
      "command": "npm run dev",
      "port": 3000,
      "domain": "backend.yourdomain.com"
    },
    {
      "name": "my-frontend", 
      "path": "/home/user/dev/my-frontend",
      "command": "npm run dev",
      "port": 5173,
      "domain": "frontend.yourdomain.com"
    }
  ],
  "settings": {
    "dashboardPort": 9000,
    "dashboardDomain": "hub.yourdomain.com",
    "traefikDynamicDir": "/etc/dokploy/traefik/dynamic"
  }
}
```

## Architecture (Dokploy Integration)

```
┌─────────────────────────────────────────────────────┐
│              Traefik (via Dokploy)                   │
│         Automatic SSL (Let's Encrypt)               │
└─────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  Dashboard    │ │  Project A    │ │  Project B    │
│  :9000        │ │  Dev Server   │ │  Dev Server   │
│  via Traefik  │ │  :3000        │ │  :5173        │
└───────────────┘ └───────────────┘ └───────────────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
              ┌───────────────────────┐
              │       PM2             │
              │   Process Manager     │
              └───────────────────────┘
```

## Directory Structure

```
workspace-hub/
├── README.md
├── agents.md              # AI assistant instructions
├── config/
│   ├── projects.json      # Project configurations
│   └── traefik/          # Generated Traefik configs (symlinked to Dokploy)
├── dashboard/            # Web dashboard UI
│   ├── package.json
│   ├── server.js
│   └── public/
├── scripts/
│   ├── setup.sh          # Initial setup
│   ├── start.sh          # Start all services
│   ├── stop.sh           # Stop all services
│   ├── manage.sh         # Manage individual projects
│   └── generate-traefik.sh  # Generate Traefik dynamic configs
└── systemd/              # Systemd service files
    └── workspace-hub.service
```

## Usage

### From Dashboard

Open `https://hub.yourdomain.com` to:
- View all projects and their status
- Start/stop dev servers
- Access project URLs
- View logs

### From CLI

```bash
# List all projects
./scripts/manage.sh list

# Start a project
./scripts/manage.sh start my-backend

# Stop a project  
./scripts/manage.sh stop my-backend

# View logs
./scripts/manage.sh logs my-backend

# Restart all
./scripts/manage.sh restart-all
```

### From SSH (Phone/Tablet)

```bash
ssh user@your-vps

# Check status
cd workspace-hub && ./scripts/manage.sh list

# Work on a project
cd ~/dev/my-backend
# Use your preferred editor or AI assistant
```

## How It Works with Dokploy

1. **Traefik** (managed by Dokploy) handles all HTTP/HTTPS traffic
2. **PM2** manages your dev server processes
3. **Dashboard** runs as a Node.js process (managed by PM2)
4. **Traefik configs** are generated and placed in `/etc/dokploy/traefik/dynamic/`
5. Traefik auto-reloads when configs change

### Ports

All dev servers bind to localhost only. Traefik proxies external traffic to them:
- External: `https://project.yourdomain.com` → Traefik → `localhost:port`

## Security

- HTTPS enabled by default via Traefik/Let's Encrypt
- Dashboard protected with basic auth (optional)
- Dev servers only accessible via Traefik reverse proxy
- SSH key-based authentication recommended
- Firewall: only expose ports 22, 80, 443

## License

MIT

## Contributing

Contributions welcome! Please read `agents.md` for development guidelines.
