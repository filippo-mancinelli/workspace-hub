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
  .option('--quick', 'Quick setup with minimal questions')
  .action(async (options) => {
    const configDir = options.path;
    const configPath = path.join(configDir, 'projects.json');
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      console.log(`Created config directory: ${configDir}`);
    }
    
    if (fs.existsSync(configPath)) {
      console.log(`Config already exists at: ${configPath}`);
      console.log('Run workspace-hub add to add more projects');
      return;
    }
    
    let config;
    if (options.quick) {
      const { wizardQuickSetup } = require('../src/lib/wizard');
      config = await wizardQuickSetup();
    } else {
      const { wizardInit } = require('../src/lib/wizard');
      config = await wizardInit();
    }
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`\n✓ Created config file: ${configPath}`);
    
    if (config.settings.ngrokToken) {
      const { configureAuthToken } = require('../src/lib/tunnel');
      configureAuthToken(config.settings.ngrokToken);
    }
    
    console.log('\n🚀 Next steps:');
    console.log('  1. Run: workspace-hub start --all');
    console.log('  2. Add more projects: workspace-hub add');
    if (config.projects.length > 0) {
      console.log(`  3. Access your ${config.projects.length} project(s)!`);
    }
    console.log('');
  });

// Add command
program
  .command('add')
  .description('Add a new project to configuration')
  .action(async () => {
    const { loadConfig, saveConfig } = require('../src/lib/config');
    const { wizardAddProject } = require('../src/lib/wizard');
    const readline = require('readline');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const config = loadConfig();
    const project = await wizardAddProject(rl);
    
    config.projects.push(project);
    saveConfig(config);
    
    console.log(`\n✓ Added project: ${project.name}`);
    console.log(`  Run: workspace-hub generate && workspace-hub start ${project.name}`);
    rl.close();
  });

// Setup command (install dependencies)
program
  .command('setup')
  .description('Install dependencies (PM2, Caddy, ngrok)')
  .option('--skip-caddy', 'Skip Caddy installation')
  .option('--skip-ngrok', 'Skip ngrok installation')
  .action((options) => {
    const { spawn } = require('child_process');
    const path = require('path');
    
    console.log('=== Installing Dependencies ===\n');
    
    // PM2
    console.log('Checking PM2...');
    const pm2Check = spawn('which', ['pm2'], { shell: true });
    pm2Check.on('close', (code) => {
      if (code !== 0) {
        console.log('Installing PM2...');
        spawn('npm', ['install', '-g', 'pm2'], { stdio: 'inherit' });
      } else {
        console.log('✓ PM2 already installed');
      }
    });
    
    // Caddy
    if (!options.skipCaddy) {
      console.log('\nChecking Caddy...');
      const caddyCheck = spawn('which', ['caddy'], { shell: true });
      caddyCheck.on('close', (code) => {
        if (code !== 0) {
          console.log('Installing Caddy...');
          console.log('Run: sudo apt install -y caddy');
          console.log('Or: curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg');
        } else {
          console.log('✓ Caddy already installed');
        }
      });
    }
    
    // ngrok
    if (!options.skipNgrok) {
      console.log('\nChecking ngrok...');
      const ngrokCheck = spawn('which', ['ngrok'], { shell: true });
      ngrokCheck.on('close', (code) => {
        if (code !== 0) {
          console.log('Installing ngrok...');
          console.log('Run: sudo apt install -y ngrok');
          console.log('Or download from: https://ngrok.com/download');
        } else {
          console.log('✓ ngrok already installed');
        }
      });
    }
    
    console.log('\n✓ Dependency check complete');
    console.log('Run: workspace-hub init to start configuration');
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
