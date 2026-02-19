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
      "enabled": true
    },
    {
      "name": "my-api",
      "path": "/home/user/dev/my-api",
      "command": "uvicorn main:app --reload --host 0.0.0.0 --port 3001",
      "port": 3001,
      "domain": "dev-api.example.com",
      "enabled": true
    }
  ],
  "settings": {
    "dashboardPort": 9000,
    "dashboardDomain": "hub.example.com",
    "traefikDynamicDir": "/etc/dokploy/traefik/dynamic"
  }
}
```

**Important**: Use `--host 0.0.0.0` so Traefik can reach your dev server.

### Commands by Framework

| Framework | Command |
|-----------|---------|
| **Vite** | `npx vite --host 0.0.0.0 --port XXXX` |
| **Next.js** | `HOSTNAME=0.0.0.0 npx next dev --port XXXX` |
| **Python/FastAPI** | `uvicorn main:app --reload --host 0.0.0.0 --port XXXX` |
| **Python/Django** | `python manage.py runserver 0.0.0.0:XXXX` |

## Requirements

- Linux VPS with Dokploy (or Traefik standalone)
- Node.js 18+
- Domains pointing to your VPS

## CLI

```bash
./scripts/manage.sh list           # Show all projects
./scripts/manage.sh start <name>   # Start a project
./scripts/manage.sh stop <name>    # Stop a project
./scripts/manage.sh logs <name>    # View logs
./scripts/stop.sh                  # Stop everything
```

## How It Works

```
Internet → Traefik (HTTPS) → Dev Server (localhost)
                              ↑
                           PM2 (process manager)
```

- **Traefik**: Handles HTTPS, auto SSL via Let's Encrypt
- **PM2**: Keeps dev servers running, auto-restart on crash
- **Dashboard**: Web UI to start/stop/view logs

## License

MIT
