const { exec, execSync } = require('child_process');
const { loadConfig } = require('./config');
const path = require('path');

// Wrap command with resource limits
function wrapCommand(command, maxCpu) {
  const envMatch = command.match(/^([\w_]+=\S+\s*)+/);
  const envVars = envMatch ? envMatch[0].trim() : '';
  const actualCommand = envMatch ? command.slice(envVars.length).trim() : command;

  if (maxCpu) {
    if (envVars) {
      return `${envVars} systemd-run --user --scope --property=CPUQuota=${maxCpu} -- ${actualCommand}`;
    }
    return `systemd-run --user --scope --property=CPUQuota=${maxCpu} -- ${command}`;
  }
  return command;
}

async function startProject(name) {
  const config = loadConfig();
  const project = config.projects.find(p => p.name === name);
  
  if (!project) {
    console.error(`Project not found: ${name}`);
    process.exit(1);
  }
  
  const wrappedCommand = wrapCommand(project.command, project.maxCpu);
  let pm2Cmd = `pm2 start "${wrappedCommand}" --name "${project.name}" --cwd "${project.path}" --no-autorestart`;
  
  if (project.maxMemory) {
    pm2Cmd += ` --max-memory-restart ${project.maxMemory}`;
  }
  
  console.log(`Starting ${name}...`);
  
  return new Promise((resolve, reject) => {
    exec(pm2Cmd, (err, stdout, stderr) => {
      if (err) {
        console.error(`Failed to start ${name}:`, stderr || err.message);
        reject(err);
        return;
      }
      console.log(`Started ${name}`);
      resolve();
    });
  });
}

async function stopProject(name) {
  console.log(`Stopping ${name}...`);
  
  return new Promise((resolve, reject) => {
    exec(`pm2 stop "${name}"`, (err, stdout, stderr) => {
      if (err) {
        console.error(`Failed to stop ${name}:`, err.message);
        reject(err);
        return;
      }
      console.log(`Stopped ${name}`);
      resolve();
    });
  });
}

async function startAll() {
  const config = loadConfig();
  const enabled = config.projects.filter(p => p.enabled !== false);
  
  console.log(`Starting ${enabled.length} projects...`);
  
  for (const project of enabled) {
    try {
      await startProject(project.name);
    } catch (err) {
      console.error(`Failed to start ${project.name}`);
    }
  }
  
  console.log('Done');
}

async function stopAll() {
  const config = loadConfig();
  
  console.log('Stopping all projects...');
  
  for (const project of config.projects) {
    try {
      await stopProject(project.name);
    } catch (err) {
      // Ignore errors
    }
  }
  
  console.log('Done');
}

async function startDashboard(detach = false) {
  const serverPath = path.join(__dirname, '..', 'server.js');
  const port = process.env.DASHBOARD_PORT || 9000;
  
  if (detach) {
    execSync(`pm2 start "${serverPath}" --name workspace-hub-dashboard`, {
      env: { ...process.env, DASHBOARD_PORT: port }
    });
    console.log(`Dashboard started on port ${port}`);
    console.log('Access at: http://localhost:' + port);
  } else {
    // Run in foreground
    require('../server.js');
  }
}

async function stopDashboard() {
  try {
    execSync('pm2 stop workspace-hub-dashboard');
    console.log('Dashboard stopped');
  } catch (err) {
    console.log('Dashboard not running');
  }
}

async function listProjects() {
  const config = loadConfig();
  
  try {
    const output = execSync('pm2 jlist', { encoding: 'utf8' });
    const processes = JSON.parse(output);
    
    console.log('\nProjects:\n');
    console.log('  Name'.padEnd(25), 'Status'.padEnd(12), 'PID'.padEnd(10), 'CPU'.padEnd(8), 'Memory');
    console.log('  '.padEnd(60, '-'));
    
    for (const project of config.projects) {
      const proc = processes.find(p => p.name === project.name);
      if (proc) {
        const mem = formatMemory(proc.monit.memory);
        console.log(
          `  ${project.name.padEnd(23)}`,
          proc.pm2_env.status.padEnd(10),
          String(proc.pid).padEnd(8),
          `${proc.monit.cpu}%`.padEnd(6),
          mem
        );
      } else {
        console.log(`  ${project.name.padEnd(23)}`, 'stopped'.padEnd(10), '-'.padEnd(8), '-'.padEnd(6), '-');
      }
    }
    console.log();
  } catch (err) {
    console.error('Failed to get process list:', err.message);
  }
}

function formatMemory(bytes) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + 'MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(1) + 'GB';
}

async function showLogs(project, lines = 50) {
  if (!project) {
    console.log('Specify a project name');
    return;
  }
  
  try {
    execSync(`pm2 logs ${project} --lines ${lines} --nostream`, { stdio: 'inherit' });
  } catch (err) {
    console.error('Failed to get logs:', err.message);
  }
}

module.exports = {
  startProject,
  stopProject,
  startAll,
  stopAll,
  startDashboard,
  stopDashboard,
  listProjects,
  showLogs
};
