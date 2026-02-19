# AI Agent Instructions

This document provides context and guidelines for AI assistants (like Droid) working on this project.

## Project Overview

Workspace Hub is a self-hosted development environment manager. Its purpose is to enable continuous remote development from any device (including phones via SSH).

## Core Goals

1. **Simplicity**: Easy to set up on any VPS
2. **Reliability**: Dev servers stay up and auto-restart
3. **Accessibility**: HTTPS URLs for all projects
4. **Visibility**: Dashboard to monitor and control everything

## Architecture Decisions

### Reverse Proxy: Traefik (via Dokploy)
- Already installed and configured via Dokploy
- Automatic HTTPS with Let's Encrypt
- Dynamic configuration via YAML files in /etc/dokploy/traefik/dynamic/
- Uses Docker gateway IP (172.17.0.1) to reach host services

### Process Manager: PM2
- Node.js native
- Easy log management
- Auto-restart on crash
- Simple API for dashboard

### Dashboard: Express + HTMX
- Minimal dependencies
- Real-time status updates via SSE
- Mobile-friendly UI

## File Conventions

### Config Files
- `config/projects.json`: User's project definitions
- `config/projects.example.json`: Template (committed)
- Traefik configs: Generated in `/etc/dokploy/traefik/dynamic/workspace-hub-*.yml`

### Scripts
- All scripts in `scripts/` directory
- Executable with shebang `#!/bin/bash`
- Use absolute paths from config
- Return meaningful exit codes

### Dashboard
- Keep it minimal and functional
- Mobile-first responsive design
- No heavy frameworks (vanilla JS + HTMX is fine)

## When Adding Features

1. Check if similar functionality exists
2. Update README.md if user-facing
3. Add configuration options to `config/projects.json` schema
4. Test with multiple projects
5. Ensure scripts are idempotent

## Common Tasks

### Add a new project
User should edit `config/projects.json`:
```json
{
  "name": "project-name",
  "path": "/absolute/path/to/project",
  "command": "npm run dev",
  "port": 3000,
  "domain": "project.example.com"
}
```

### Modify process management
Edit `scripts/manage.sh` or dashboard API endpoints.

### Update reverse proxy config
Regenerate with `scripts/generate-traefik.sh` after config changes. Traefik auto-reloads.

## Error Handling

- Scripts should validate config before acting
- Dashboard should show clear error messages
- Log all errors to `/var/log/workspace-hub/`

## Security Considerations

- Never expose internal ports directly
- Dashboard must require authentication
- Validate all inputs in API endpoints
- Use environment variables for secrets

## Testing

Currently manual testing. Verify:
1. Fresh install works
2. Projects start/stop correctly
3. Dashboard reflects actual state
4. HTTPS URLs work
5. Logs are accessible
