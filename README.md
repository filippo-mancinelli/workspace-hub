# Workspace Hub

Self-hosted dev environment manager. Keep all your dev servers running with HTTPS URLs, accessible from anywhere.

## Quick Start

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/workspace-hub.git
cd workspace-hub

# 2. Setup (installs PM2, creates config)
./scripts/setup.sh

# 3. Configure your projects
nano config/projects.json

# 4. Start
./scripts/start.sh
```

Open `https://hub.yourdomain.com` to manage all projects.

## Installation (npm)

```bash
npm install -g workspace-hub

# Initialize configuration
workspace-hub init

# Start all projects
workspace-hub start --all

# Start dashboard
workspace-hub dashboard
```

## Configuration

Edit `config/projects.json`:

```json
{
  "projects": [
    {
      "name": "my-frontend",
      "path": "/home/user/dev/my-frontend",
      "command": "npx vite --host 0.0.0.0 --port 3000",
      "port": 3000,
      "domain": "dev-frontend.example.com",
      "tunnel": false,
      "enabled": true
    },
    {
      "name": "my-api",
      "path": "/home/user/dev/my-api",
      "command": "uvicorn main:app --reload --host 0.0.0.0 --port 3001",
      "port": 3001,
      "domain": "dev-api.example.com",
      "tunnel": false,
      "enabled": true
    },
    {
      "name": "my-tunnel-app",
      "path": "/home/user/dev/my-tunnel-app",
      "command": "npm run dev -- --port 3002",
      "port": 3002,
      "domain": "",
      "tunnel": true,
      "enabled": true
    }
  ],
  "settings": {
    "dashboardPort": 9000,
    "dashboardDomain": "hub.example.com",
    "caddyConfigDir": "/etc/caddy/conf.d"
  }
}
```

**Two access modes:**
- **Domain mode**: Set `domain` and `tunnel: false` for custom HTTPS domains via Caddy
- **Tunnel mode**: Set `tunnel: true` for HTTPS URLs via ngrok (no domain needed)

**Important**: Use `--host 0.0.0.0` so Traefik can reach your dev server.

### Commands by Framework

| Framework | Command |
|-----------|---------|
| **Vite** | `npx vite --host 0.0.0.0 --port XXXX` |
| **Next.js** | `HOSTNAME=0.0.0.0 npx next dev --port XXXX` |
| **Python/FastAPI** | `uvicorn main:app --reload --host 0.0.0.0 --port XXXX` |
| **Python/Django** | `python manage.py runserver 0.0.0.0:XXXX` |

## Requirements

- Linux server (Debian/Ubuntu/RHEL based)
- Node.js 18+

**For domain mode:**
- Domains pointing to your server
- Ports 80 and 443 available (for Caddy HTTPS)

**For tunnel mode:**
- ngrok account and auth token (free)
- No domain required

## Tunnel Setup (ngrok)

```bash
# Configure ngrok auth token
workspace-hub tunnel config YOUR_NGROK_AUTH_TOKEN

# Or include it during init
workspace-hub init --ngrok-token YOUR_NGROK_AUTH_TOKEN

# Get your free token from: https://dashboard.ngrok.com/get-started/your-authtoken
```

Then set `"tunnel": true` in your project config to enable HTTPS via ngrok.

## CLI

### Using the workspace-hub CLI:

```bash
workspace-hub list              # Show all projects
workspace-hub start <name>      # Start a project
workspace-hub start --all       # Start all projects
workspace-hub stop <name>       # Stop a project
workspace-hub stop --all        # Stop all projects
workspace-hub restart <name>    # Restart a project
workspace-hub logs <name>       # View logs
workspace-hub dashboard         # Start the dashboard
workspace-hub generate          # Generate Caddy configs
workspace-hub init              # Initialize configuration

# Tunnel management (ngrok)
workspace-hub tunnel start [project]  # Start tunnel for project
workspace-hub tunnel stop [project]   # Stop tunnel
workspace-hub tunnel list             # List active tunnels
workspace-hub tunnel config <token>   # Configure ngrok auth token
```

### Using the scripts:

```bash
./scripts/manage.sh list           # Show all projects
./scripts/manage.sh start <name>   # Start a project
./scripts/manage.sh stop <name>    # Stop a project
./scripts/manage.sh logs <name>    # View logs
./scripts/stop.sh                  # Stop everything
```

## How It Works

```
Internet → Caddy (HTTPS) → Dev Server (localhost)
                            ↑
                         PM2 (process manager)
```

- **Caddy**: Handles HTTPS, auto SSL via Let's Encrypt (installed automatically)
- **PM2**: Keeps dev servers running, auto-restart on crash
- **Dashboard**: Web UI to start/stop/view logs

## License

MIT
