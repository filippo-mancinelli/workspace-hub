const { loadConfig } = require('./lib/config');
const { listProjects } = require('./lib/pm2');

function main() {
  const config = loadConfig();
  console.log(`Workspace Hub v${require('../package.json').version}`);
  console.log(`Config: ${require('./lib/config').getConfigPath()}`);
  console.log(`\nFound ${config.projects.length} project(s)`);
  
  if (config.projects.length > 0) {
    listProjects();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
