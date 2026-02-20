const fs = require('fs');
const path = require('path');

const CONFIG_DIR = process.env.WORKSPACE_HUB_CONFIG || path.join(process.env.HOME, '.workspace-hub');
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(CONFIG_DIR, 'projects.json');

function getConfigPath() {
  return CONFIG_PATH;
}

function loadConfig() {
  try {
    const content = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`Config not found at: ${CONFIG_PATH}`);
      console.error('Run: workspace-hub init');
      process.exit(1);
    }
    console.error('Failed to load config:', err.message);
    return { projects: [], settings: {} };
  }
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

module.exports = {
  getConfigPath,
  loadConfig,
  saveConfig,
  CONFIG_DIR,
  CONFIG_PATH
};
