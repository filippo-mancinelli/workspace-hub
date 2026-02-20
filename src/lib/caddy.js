const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { loadConfig } = require('./config');

function generateCaddy(outputDir) {
  const config = loadConfig();
  const caddyDir = outputDir || config.settings.caddyConfigDir || '/etc/caddy/conf.d';
  
  if (!fs.existsSync(caddyDir)) {
    try {
      fs.mkdirSync(caddyDir, { recursive: true, mode: 0o755 });
      console.log(`Created Caddy config directory: ${caddyDir}`);
    } catch (err) {
      console.error(`Cannot create Caddy directory: ${caddyDir}`);
      console.error('Try running with sudo or change settings.caddyConfigDir in config/projects.json');
      process.exit(1);
    }
  }
  
  let generated = 0;
  
  for (const project of config.projects) {
    if (!project.domain || !project.port) continue;
    
    const caddyConf = generateCaddyConfig(project);
    const filename = `workspace-hub-${project.name}.caddyfile`;
    const filepath = path.join(caddyDir, filename);
    
    fs.writeFileSync(filepath, caddyConf);
    console.log(`Generated: ${filepath}`);
    generated++;
  }
  
  console.log(`\nGenerated ${generated} Caddy configs`);
  
  reloadCaddy();
}

function generateCaddyConfig(project) {
  const safeName = project.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  
  return `# Workspace Hub - ${project.name}
${project.domain} {
    reverse_proxy 127.0.0.1:${project.port}
    encode zstd gzip
    
    # Security headers
    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
`;
}

function reloadCaddy() {
  console.log('Reloading Caddy...');
  exec('sudo systemctl reload caddy', (error, stdout, stderr) => {
    if (error) {
      console.error(`Failed to reload Caddy: ${error.message}`);
      if (stderr) console.error(stderr);
    } else {
      console.log('Caddy reloaded successfully');
    }
  });
}

module.exports = {
  generateCaddy
};
