#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/config/projects.json"

usage() {
  echo "Usage: $0 <command> [project-name]"
  echo ""
  echo "Commands:"
  echo "  list              List all projects and their status"
  echo "  start <name>      Start a specific project"
  echo "  stop <name>       Stop a specific project"
  echo "  restart <name>    Restart a specific project"
  echo "  logs <name>       Show logs for a project"
  echo "  start-all         Start all enabled projects"
  echo "  stop-all          Stop all projects"
  echo "  restart-all       Restart all projects"
  echo ""
}

get_projects() {
  if [ -f "$CONFIG_FILE" ]; then
    cat "$CONFIG_FILE" | node -e "
      const fs = require('fs');
      const config = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
      config.projects.forEach(p => console.log(p.name + '|' + p.path + '|' + p.command + '|' + (p.enabled !== false)));
    "
  fi
}

case "$1" in
  list)
    echo "Projects Status:"
    echo "================"
    get_projects | while IFS='|' read -r name path command enabled; do
      status=$(pm2 describe "$name" 2>/dev/null | grep 'status' | awk '{print $4}' || echo "stopped")
      if [ "$enabled" = "false" ]; then
        status="disabled"
      fi
      printf "%-20s %s\n" "$name" "$status"
    done
    echo ""
    echo "Run '$0 logs <name>' to view logs"
    ;;

  start)
    if [ -z "$2" ]; then
      echo "Error: project name required"
      usage
      exit 1
    fi
    
    # Get project config
    project=$(get_projects | grep "^$2|")
    if [ -z "$project" ]; then
      echo "Error: project '$2' not found in config"
      exit 1
    fi
    
    IFS='|' read -r name path command enabled <<< "$project"
    
    echo "Starting $name..."
    cd "$path"
    pm2 start "$command" --name "$name" --cwd "$path"
    echo "Started $name"
    ;;

  stop)
    if [ -z "$2" ]; then
      echo "Error: project name required"
      usage
      exit 1
    fi
    echo "Stopping $2..."
    pm2 stop "$2" 2>/dev/null || echo "Project not running"
    ;;

  restart)
    if [ -z "$2" ]; then
      echo "Error: project name required"
      usage
      exit 1
    fi
    echo "Restarting $2..."
    pm2 restart "$2" 2>/dev/null || echo "Project not running, trying to start..."
    "$0" start "$2"
    ;;

  logs)
    if [ -z "$2" ]; then
      echo "Error: project name required"
      usage
      exit 1
    fi
    pm2 logs "$2" --lines 100
    ;;

  start-all)
    echo "Starting all enabled projects..."
    get_projects | while IFS='|' read -r name path command enabled; do
      if [ "$enabled" = "true" ]; then
        echo "Starting $name..."
        cd "$path" 2>/dev/null || { echo "Warning: path $path not found, skipping"; continue; }
        pm2 start "$command" --name "$name" --cwd "$path" 2>/dev/null || echo "Failed to start $name"
      fi
    done
    echo ""
    pm2 list
    ;;

  stop-all)
    echo "Stopping all projects..."
    get_projects | while IFS='|' read -r name path command enabled; do
      pm2 stop "$name" 2>/dev/null || true
    done
    echo "All projects stopped"
    ;;

  restart-all)
    "$0" stop-all
    sleep 2
    "$0" start-all
    ;;

  *)
    usage
    ;;
esac
