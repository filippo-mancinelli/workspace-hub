#!/usr/bin/env node

const { program } = require('commander');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const pkg = require('../package.json');

// Default paths
const CONFIG_DIR = process.env.WORKSPACE_HUB_CONFIG || path.join(process.env.HOME, '.workspace-hub');
const CONFIG_PATH = path.join(CONFIG_DIR, 'projects.json');

program
  .name('workspace-hub')
  .description('Self-hosted development environment manager')
  .version(pkg.version);

// Init command
program
  .command('init')
  .description('Initialize workspace-hub configuration')
  .option('--path <path>', 'Config directory path', CONFIG_DIR)
  .option('--ngrok-token <token>', 'ngrok auth token for tunnels')
  .action((options) => {
    const configDir = options.path;
    const configPath = path.join(configDir, 'projects.json');
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      console.log(`Created config directory: ${configDir}`);
    }
    
    if (fs.existsSync(configPath)) {
      console.log(`Config already exists at: ${configPath}`);
      return;
    }
    
    const template = fs.readFileSync(
      path.join(__dirname, '../templates/projects.example.json'),
      'utf8'
    );
    fs.writeFileSync(configPath, template);
    console.log(`Created config file: ${configPath}`);
    
    if (options.ngrokToken) {
      const { configureAuthToken } = require('../src/lib/tunnel');
      configureAuthToken(options.ngrokToken);
    }
    
    console.log('\nEdit the config file to add your projects, then run:');
    console.log('  workspace-hub start --all');
  });

// Start command
program
  .command('start [project]')
  .description('Start a project or all projects')
  .option('--all', 'Start all enabled projects')
  .option('--dashboard', 'Start the dashboard server')
  .action(async (project, options) => {
    const { startProject, startAll, startDashboard } = require('../src/lib/pm2');
    
    if (options.dashboard) {
      await startDashboard();
      return;
    }
    
    if (options.all) {
      await startAll();
      return;
    }
    
    if (project) {
      await startProject(project);
      return;
    }
    
    console.log('Specify a project name or use --all / --dashboard');
  });

// Stop command
program
  .command('stop [project]')
  .description('Stop a project or all projects')
  .option('--all', 'Stop all projects')
  .option('--dashboard', 'Stop the dashboard server')
  .action(async (project, options) => {
    const { stopProject, stopAll, stopDashboard } = require('../src/lib/pm2');
    
    if (options.dashboard) {
      await stopDashboard();
      return;
    }
    
    if (options.all) {
      await stopAll();
      return;
    }
    
    if (project) {
      await stopProject(project);
      return;
    }
    
    console.log('Specify a project name or use --all / --dashboard');
  });

// List command
program
  .command('list')
  .description('List all projects with status')
  .action(async () => {
    const { listProjects } = require('../src/lib/pm2');
    await listProjects();
  });

// Logs command
program
  .command('logs [project]')
  .description('Show logs for a project')
  .option('--lines <n>', 'Number of lines to show', '50')
  .action(async (project, options) => {
    const { showLogs } = require('../src/lib/pm2');
    await showLogs(project, parseInt(options.lines));
  });

// Dashboard command
program
  .command('dashboard')
  .description('Start the web dashboard')
  .option('--port <port>', 'Dashboard port', '9000')
  .option('--detach', 'Run in background')
  .action(async (options) => {
    const { startDashboard } = require('../src/lib/pm2');
    process.env.DASHBOARD_PORT = options.port;
    await startDashboard(options.detach);
  });

// Generate command
program
  .command('generate')
  .description('Generate Caddy configuration')
  .option('--output <path>', 'Output directory for Caddy configs')
  .action((options) => {
    const { generateCaddy } = require('../src/lib/caddy');
    generateCaddy(options.output);
  });

// Tunnel commands
const tunnelCmd = program.command('tunnel')
  .description('Manage ngrok tunnels');

tunnelCmd.command('start [project]')
  .description('Start ngrok tunnel for a project')
  .action((project) => {
    const { startTunnel, startProjectTunnels } = require('../src/lib/tunnel');
    if (project) {
      startTunnel({ name: project });
    } else {
      startProjectTunnels();
    }
  });

tunnelCmd.command('stop [project]')
  .description('Stop ngrok tunnel for a project')
  .action((project) => {
    const { stopTunnel, stopAllTunnels } = require('../src/lib/tunnel');
    if (project) {
      stopTunnel(project);
    } else {
      stopAllTunnels();
    }
  });

tunnelCmd.command('list')
  .description('List all active tunnels')
  .action(() => {
    const { listTunnels } = require('../src/lib/tunnel');
    const tunnels = listTunnels();
    
    if (tunnels.length === 0) {
      console.log('No active tunnels');
      return;
    }
    
    console.log('Active tunnels:');
    tunnels.forEach(t => {
      console.log(`  ${t.name}: ${t.url}`);
    });
  });

tunnelCmd.command('config <token>')
  .description('Configure ngrok auth token')
  .action((token) => {
    const { configureAuthToken } = require('../src/lib/tunnel');
    configureAuthToken(token);
  });

program.parse();
