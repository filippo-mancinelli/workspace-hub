const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./config');

const TUNNEL_DIR = path.join(process.env.HOME, '.workspace-hub', 'tunnels');

function ensureTunnelDir() {
  if (!fs.existsSync(TUNNEL_DIR)) {
    fs.mkdirSync(TUNNEL_DIR, { recursive: true });
  }
}

function startTunnel(project) {
  const safeName = project.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const tunnelFile = path.join(TUNNEL_DIR, `${safeName}.json`);
  
  if (fs.existsSync(tunnelFile)) {
    console.log(`Tunnel already running for ${project.name}`);
    return getTunnelInfo(project.name);
  }
  
  console.log(`Starting ngrok tunnel for ${project.name} on port ${project.port}...`);
  
  const ngrok = spawn('ngrok', ['http', `${project.port}`, '--log=stdout'], {
    detached: false
  });
  
  ngrok.stdout.on('data', (data) => {
    const output = data.toString();
    const urlMatch = output.match(/https:\/\/[a-z0-9\-]+\.ngrok-free\.app/);
    if (urlMatch) {
      const url = urlMatch[0];
      console.log(`Tunnel URL: ${url}`);
      saveTunnelInfo(project.name, { url, pid: ngrok.pid });
    }
  });
  
  ngrok.stderr.on('data', (data) => {
    console.error(`ngrok error: ${data}`);
  });
  
  ngrok.on('exit', (code) => {
    console.log(`ngrok tunnel for ${project.name} exited with code ${code}`);
    deleteTunnelInfo(project.name);
  });
  
  return { starting: true };
}

function stopTunnel(projectName) {
  const safeName = projectName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const tunnelFile = path.join(TUNNEL_DIR, `${safeName}.json`);
  
  if (!fs.existsSync(tunnelFile)) {
    console.log(`No tunnel found for ${projectName}`);
    return;
  }
  
  const info = JSON.parse(fs.readFileSync(tunnelFile, 'utf8'));
  
  try {
    process.kill(info.pid, 'SIGTERM');
    console.log(`Stopped tunnel for ${projectName}`);
    deleteTunnelInfo(projectName);
  } catch (err) {
    console.error(`Failed to stop tunnel: ${err.message}`);
    deleteTunnelInfo(projectName);
  }
}

function stopAllTunnels() {
  ensureTunnelDir();
  const files = fs.readdirSync(TUNNEL_DIR);
  
  files.forEach(file => {
    if (file.endsWith('.json')) {
      const projectName = file.replace('.json', '');
      stopTunnel(projectName);
    }
  });
}

function getTunnelInfo(projectName) {
  const safeName = projectName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const tunnelFile = path.join(TUNNEL_DIR, `${safeName}.json`);
  
  if (!fs.existsSync(tunnelFile)) {
    return null;
  }
  
  return JSON.parse(fs.readFileSync(tunnelFile, 'utf8'));
}

function saveTunnelInfo(projectName, info) {
  ensureTunnelDir();
  const safeName = projectName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const tunnelFile = path.join(TUNNEL_DIR, `${safeName}.json`);
  fs.writeFileSync(tunnelFile, JSON.stringify(info, null, 2));
}

function deleteTunnelInfo(projectName) {
  const safeName = projectName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const tunnelFile = path.join(TUNNEL_DIR, `${safeName}.json`);
  
  if (fs.existsSync(tunnelFile)) {
    fs.unlinkSync(tunnelFile);
  }
}

function listTunnels() {
  ensureTunnelDir();
  const files = fs.readdirSync(TUNNEL_DIR);
  const tunnels = [];
  
  files.forEach(file => {
    if (file.endsWith('.json')) {
      const projectName = file.replace('.json', '');
      const info = JSON.parse(fs.readFileSync(path.join(TUNNEL_DIR, file), 'utf8'));
      tunnels.push({ name: projectName, ...info });
    }
  });
  
  return tunnels;
}

function startProjectTunnels() {
  const config = loadConfig();
  const configDir = process.env.WORKSPACE_HUB_CONFIG || path.join(process.env.HOME, '.workspace-hub');
  const projectsJsonPath = path.join(configDir, 'projects.json');
  
  if (!fs.existsSync(projectsJsonPath)) {
    return;
  }
  
  config.projects.forEach(project => {
    if (project.tunnel && project.enabled !== false && project.port) {
      startTunnel(project);
    }
  });
}

function configureAuthToken(token) {
  console.log('Configuring ngrok auth token...');
  const ngrok = spawn('ngrok', ['config', 'add-authtoken', token], { stdio: 'inherit' });
  
  ngrok.on('close', (code) => {
    if (code === 0) {
      console.log('ngrok auth token configured successfully');
    } else {
      console.error('Failed to configure ngrok auth token');
    }
  });
}

module.exports = {
  startTunnel,
  stopTunnel,
  stopAllTunnels,
  getTunnelInfo,
  listTunnels,
  startProjectTunnels,
  configureAuthToken
};
