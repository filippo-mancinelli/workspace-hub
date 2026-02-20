const readline = require('readline');
const path = require('path');
const fs = require('fs');

function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function question(rl, query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function wizardInit() {
  const rl = createReadline();
  const config = {
    projects: [],
    settings: {
      dashboardPort: 9000,
      caddyConfigDir: '/etc/caddy/conf.d'
    }
  };

  console.log('\n=== Workspace Hub Setup Wizard ===\n');
  console.log('This wizard will guide you through the setup.\n');

  // Dashboard setup
  const dashboardDomain = await question(rl, 'Dashboard domain (leave empty to skip): ');
  if (dashboardDomain.trim()) {
    config.settings.dashboardDomain = dashboardDomain.trim();
    console.log(`✓ Dashboard will be accessible at https://${dashboardDomain}\n`);
  } else {
    console.log('✓ Dashboard will run on http://localhost:9000\n');
  }

  // Dashboard port
  const dashboardPort = await question(rl, `Dashboard port [9000]: `);
  if (dashboardPort.trim()) {
    config.settings.dashboardPort = parseInt(dashboardPort.trim());
  }
  console.log(`✓ Dashboard port: ${config.settings.dashboardPort}\n`);

  // Caddy directory
  const caddyDir = await question(rl, `Caddy config directory [/etc/caddy/conf.d]: `);
  if (caddyDir.trim()) {
    config.settings.caddyConfigDir = caddyDir.trim();
  }
  console.log(`✓ Caddy configs will go to: ${config.settings.caddyConfigDir}\n`);

  // ngrok setup
  console.log('--- ngrok Setup (HTTPS without domains) ---');
  const ngrokToken = await question(rl, 'ngrok auth token (leave empty if you don\'t have one): ');
  if (ngrokToken.trim()) {
    config.settings.ngrokToken = ngrokToken.trim();
    console.log('✓ ngrok token configured\n');
  } else {
    console.log('ℹ Get free token from: https://dashboard.ngrok.com/get-started/your-authtoken\n');
  }

  // Project setup
  console.log('\n--- Add Projects ---');
  console.log('You can add projects now or do it later in the config file.\n');

  let addMore = 'yes';
  while (addMore.toLowerCase() === 'yes' || addMore.toLowerCase() === 'y') {
    const project = await wizardAddProject(rl);
    config.projects.push(project);
    
    console.log(`✓ Added project: ${project.name}\n`);
    addMore = await question(rl, 'Add another project? (yes/no): ');
  }

  rl.close();
  return config;
}

async function wizardAddProject(rl) {
  console.log('\n📦 New Project Configuration\n');

  const name = await question(rl, 'Project name: ');
  const projectPath = await question(rl, 'Project path (absolute): ');
  const port = await question(rl, 'Project port: ');
  
  // Access mode selection
  console.log('\n--- Access Mode ---');
  console.log('1. Domain mode: Use your own domain (requires domain pointing to this server)');
  console.log('2. Tunnel mode: Use ngrok tunnel (no domain required, HTTPS on the go)');
  
  const mode = await question(rl, 'Choose mode (1/2): ');
  
  let project = {
    name: name.trim(),
    path: projectPath.trim(),
    port: parseInt(port.trim()),
    enabled: true
  };

  if (mode === '1') {
    const domain = await question(rl, 'Domain (e.g., dev.example.com): ');
    project.domain = domain.trim();
    project.tunnel = false;
    console.log(`✓ Will use domain: ${domain}`);
  } else {
    project.tunnel = true;
    console.log('✓ Will use ngrok tunnel (URL generated automatically)');
  }

  // Framework detection
  console.log('\n--- Framework/Stack ---');
  console.log('1. Vite (npm run dev)');
  console.log('2. Next.js (npm run dev)');
  console.log('3. React (npm start)');
  console.log('4. Python/FastAPI (uvicorn main:app --reload)');
  console.log('5. Python/Django (python manage.py runserver)');
  console.log('6. Custom command');
  
  const framework = await question(rl, 'Choose framework (1-6): ');

  const commands = {
    '1': 'npx vite --host 0.0.0.0',
    '2': 'HOSTNAME=0.0.0.0 npx next dev',
    '3': 'npm start',
    '4': 'uvicorn main:app --reload --host 0.0.0.0',
    '5': 'python manage.py runserver 0.0.0.0',
    '6': null
  };

  if (framework === '6') {
    const customCmd = await question(rl, 'Enter custom command: ');
    project.command = customCmd.trim();
  } else {
    project.command = `${commands[framework]} --port ${project.port}`;
  }

  console.log(`✓ Command: ${project.command}\n`);

  return project;
}

async function wizardQuickSetup() {
  const rl = createReadline();

  console.log('\n=== Quick Setup ===\n');
  console.log('This will set up basic configuration.\n');

  const config = {
    projects: [],
    settings: {
      dashboardPort: 9000,
      caddyConfigDir: '/etc/caddy/conf.d'
    }
  };

  // Minimal questions
  const ngrokToken = await question(rl, 'ngrok auth token (optional, leave empty to skip): ');
  if (ngrokToken.trim()) {
    config.settings.ngrokToken = ngrokToken.trim();
  }

  rl.close();
  return config;
}

module.exports = {
  wizardInit,
  wizardAddProject,
  wizardQuickSetup
};
