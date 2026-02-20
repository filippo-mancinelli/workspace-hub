# Workspace Hub

Self-hosted dev environment manager. Keep all your dev servers running with HTTPS URLs, accessible from anywhere.

## Quick Start

### Option 1: Install from npm (Recommended)

```bash
# 1. Install globally
npm install -g workspace-hub

# 2. Interactive setup (guides you through everything)
workspace-hub init

# 3. Start everything
workspace-hub start --all
```

That's it! The wizard will ask you questions and set everything up automatically.

### Option 2: Clone from GitHub

```bash
# 1. Clone
git clone https://github.com/filippo-mancinelli/workspace-hub.git
cd workspace-hub

# 2. Install dependencies
npm install

# 3. Link globally (for CLI access)
npm link

# 4. Interactive setup
workspace-hub init

# 5. Start everything
workspace-hub start --all
```

### Prerequisites

Before installing, make sure you have:

- **Node.js 18+** - Download from [nodejs.org](https://nodejs.org/)
- **Linux server** (Debian/Ubuntu/RHEL based)

The setup wizard will guide you through installing PM2, Caddy, and optionally ngrok.

## Getting Started Guide

### First time setup

1. **Run the setup wizard:**
   ```bash
   workspace-hub init
   ```
   The wizard will ask:
   - Dashboard domain (optional)
   - Dashboard port
   - Caddy config directory
   - ngrok token (optional)
   - Projects to add

2. **Add your projects** (if not done in wizard):
   ```bash
   workspace-hub add
   ```
   Select your framework and enter project details.

3. **Generate configs:**
   ```bash
   workspace-hub generate
   ```

4. **Start everything:**
   ```bash
   workspace-hub start --all
   ```

5. **Access your projects:**
   - Domain mode: `https://your-domain.com`
   - Tunnel mode: Check with `workspace-hub tunnel list`

## Installation

### npm (Global Install)

The easiest way to install Workspace Hub is via npm:

```bash
# Install globally
npm install -g workspace-hub

# Initialize configuration (interactive wizard)
workspace-hub init

# Start all projects
workspace-hub start --all

# Start dashboard
workspace-hub dashboard
```

### GitHub Clone

Alternatively, clone the repository:

```bash
git clone https://github.com/filippo-mancinelli/workspace-hub.git
cd workspace-hub

# Install dependencies
npm install

# Link globally (for CLI access)
npm link

# Initialize
workspace-hub init
```

## Configuration

You have two options:

### Option 1: Interactive Wizard (Recommended)
```bash
workspace-hub init           # Full interactive setup
workspace-hub init --quick   # Quick setup
workspace-hub add            # Add more projects later
```

### Option 2: Manual Configuration

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

### Permissions

Most Workspace Hub commands don't require sudo, but some operations need elevated privileges:

**Commands that need sudo:**
```bash
sudo workspace-hub generate    # Writes Caddy configs to /etc/caddy
sudo workspace-hub setup        # Installs system packages
```

**Commands that don't need sudo:**
```bash
workspace-hub init             # Creates user config
workspace-hub add              # Adds projects to config
workspace-hub start --all      # Starts PM2 processes
workspace-hub list             # Shows project status
workspace-hub tunnel list       # Lists tunnels
```

**Tip:** When using sudo for commands that need your config file, set the config path:
```bash
sudo -E workspace-hub generate
```

## Tunnel Setup (ngrok)

```bash
# Option 1: Use the interactive wizard (recommended)
workspace-hub init
# Follow the prompts to enter your ngrok token

# Option 2: Configure directly
workspace-hub tunnel config YOUR_NGROK_AUTH_TOKEN

# Get your free token from: https://dashboard.ngrok.com/get-started/your-authtoken
```

Then set `"tunnel": true` in your project config (or use the wizard) to enable HTTPS via ngrok.

## CLI

### Using workspace-hub CLI:

```bash
# Setup & Configuration
workspace-hub setup              # Install dependencies (PM2, Caddy, ngrok)
workspace-hub init               # Interactive setup wizard
workspace-hub init --quick       # Quick setup with minimal questions
workspace-hub add                # Add a new project (interactive)
workspace-hub generate           # Generate Caddy configs

# Project Management
workspace-hub list               # Show all projects with status
workspace-hub start <name>       # Start a project
workspace-hub start --all        # Start all projects
workspace-hub stop <name>        # Stop a project
workspace-hub stop --all         # Stop all projects
workspace-hub restart <name>      # Restart a project
workspace-hub logs <name>        # View logs

# Dashboard
workspace-hub dashboard          # Start the dashboard

# Tunnel management (ngrok)
workspace-hub tunnel start [project]  # Start tunnel for project
workspace-hub tunnel stop [project]   # Stop tunnel
workspace-hub tunnel list             # List active tunnels
workspace-hub tunnel config <token>   # Configure ngrok auth token
```

### Interactive Wizard

The `workspace-hub init` command will guide you through:

1. **Dashboard setup**: Domain and port configuration
2. **Caddy config**: Where to store reverse proxy configs
3. **ngrok setup**: Auth token for tunnel mode (optional)
4. **Project configuration**: Add projects with:
   - Project name and path
   - Port and access mode (domain or tunnel)
   - Framework/stack selection (Vite, Next.js, Python, etc.)

The wizard generates everything you need automatically!

### Using the scripts:

```bash
./scripts/manage.sh list           # Show all projects
./scripts/manage.sh start <name>   # Start a project
./scripts/manage.sh stop <name>    # Stop a project
./scripts/manage.sh logs <name>    # View logs
./scripts/stop.sh                  # Stop everything
```

## How It Works

**Domain Mode:**
```
Internet → Caddy (HTTPS) → Dev Server (localhost)
                          ↑
                       PM2 (process manager)
```

**Tunnel Mode:**
```
Internet → ngrok (HTTPS) → Dev Server (localhost)
                          ↑
                       PM2 (process manager)
```

- **Caddy**: Handles HTTPS with custom domains, auto SSL via Let's Encrypt
- **ngrok**: Provides HTTPS URLs without domains (optional)
- **PM2**: Keeps dev servers running, auto-restart on crash
- **Dashboard**: Web UI to start/stop/view logs
- **Interactive Wizard**: Guides you through setup configuration

## License

MIT
