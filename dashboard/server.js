const express = require('express');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 8080;
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, '../config/projects.json');

const LOGS_CACHE_TTL = 2000;
const LOGS_CACHE_LINES = 200;

const PM2_CACHE_TTL = 3000;
const CPU_CACHE_TTL = 500;
const STATUS_CACHE_TTL = 2000;

const logsCache = new Map();
const pm2Cache = { processes: null, timestamp: 0 };
const cpuCache = new Map();
const statusCache = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load config
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (err) {
    console.error('Failed to load config:', err);
    return { projects: [], settings: {} };
  }
}

// Update logs cache for all projects
async function updateLogsCache() {
  const config = loadConfig();
  
  for (const project of config.projects) {
    try {
      const logs = execSync(`pm2 logs ${project.name} --lines ${LOGS_CACHE_LINES} --nostream`, { encoding: 'utf8' });
      const cleanLogs = logs.replace(/\x1b\[[0-9;]*m/g, '');
      logsCache.set(project.name, {
        logs: cleanLogs,
        timestamp: Date.now()
      });
    } catch (err) {
      if (logsCache.has(project.name)) {
        const cached = logsCache.get(project.name);
        cached.timestamp = Date.now();
      }
    }
  }
}

// Get logs from cache
function getCachedLogs(name) {
  const cached = logsCache.get(name);
  if (!cached) return null;
  
  const age = Date.now() - cached.timestamp;
  if (age > LOGS_CACHE_TTL * 5) return null;
  
  return cached.logs;
}

// Refresh PM2 cache
function refreshPM2Cache() {
  try {
    const output = execSync(`pm2 jlist`, { encoding: 'utf8' });
    pm2Cache.processes = JSON.parse(output);
    pm2Cache.timestamp = Date.now();
  } catch (err) {
    console.error('Failed to refresh PM2 cache:', err);
  }
}

// Get PM2 processes from cache
function getPM2Processes() {
  const age = Date.now() - pm2Cache.timestamp;
  if (!pm2Cache.processes || age > PM2_CACHE_TTL) {
    refreshPM2Cache();
  }
  return pm2Cache.processes || [];
}

// Get CPU values for multiple PIDs in one call
function getCpuBatch(pids) {
  const now = Date.now();
  const result = {};
  const pidsToQuery = [];

  pids.forEach(pid => {
    if (!pid || pid === 0) {
      result[pid] = 0;
    } else {
      const cached = cpuCache.get(pid);
      if (cached && (now - cached.timestamp) < CPU_CACHE_TTL) {
        result[pid] = cached.cpu;
      } else {
        pidsToQuery.push(pid);
      }
    }
  });

  if (pidsToQuery.length === 0) {
    return result;
  }

  try {
    const output = execSync(`ps -p ${pidsToQuery.join(',')} -o %cpu --no-headers 2>/dev/null`, { encoding: 'utf8' });
    const lines = output.trim().split('\n');
    
    pidsToQuery.forEach((pid, i) => {
      const cpu = lines[i] ? parseFloat(lines[i].trim()) : 0;
      result[pid] = cpu;
      cpuCache.set(pid, { cpu, timestamp: now });
    });
  } catch (err) {
    pidsToQuery.forEach(pid => {
      result[pid] = 0;
    });
  }

  return result;
}

// Get PM2 status for a project (cached)
function getProjectStatus(name, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh) {
    const cached = statusCache.get(name);
    if (cached && (now - cached.timestamp) < STATUS_CACHE_TTL) {
      return cached.data;
    }
  }

  try {
    const processes = getPM2Processes();
    const proc = processes.find(p => p.name === name);
    const result = proc ? {
      status: proc.pm2_env.status,
      pid: proc.pid,
      cpu: proc.monit.cpu,
      memory: proc.monit.memory,
      uptime: proc.pm2_env.pm_uptime,
      restarts: proc.pm2_env.restart_time || 0
    } : { status: 'stopped', restarts: 0, cpu: 0 };

    statusCache.set(name, { data: result, timestamp: now });
    return result;
  } catch {
    return { status: 'stopped', restarts: 0, cpu: 0 };
  }
}

// Get status for all projects with single PM2 call
function getAllProjectStatuses(projectNames) {
  const processes = getPM2Processes();
  return projectNames.map(name => {
    const proc = processes.find(p => p.name === name);
    return proc ? {
      name,
      status: proc.pm2_env.status,
      pid: proc.pid,
      cpu: proc.monit.cpu,
      memory: proc.monit.memory,
      uptime: proc.pm2_env.pm_uptime,
      restarts: proc.pm2_env.restart_time || 0
    } : { name, status: 'stopped', restarts: 0, cpu: 0 };
  });
}

// Batch update CPU for all projects
function updateProjectCpus(projects) {
  const pids = projects
    .filter(p => p.pid && p.pid > 0)
    .map(p => p.pid);
  
  if (pids.length === 0) return;
  
  const cpuMap = getCpuBatch(pids);
  projects.forEach(p => {
    if (p.pid && p.pid > 0 && cpuMap[p.pid] !== undefined) {
      p.cpu = cpuMap[p.pid];
    }
  });
}

// API: List all projects with status
app.get('/api/projects', (req, res) => {
  const config = loadConfig();
  const projectNames = config.projects.map(p => p.name);

  // Get all statuses with single PM2 call
  const statuses = getAllProjectStatuses(projectNames);

  // Merge with config
  const projects = config.projects.map((p, i) => ({
    ...p,
    ...statuses[i]
  }));

  updateProjectCpus(projects);
  res.json(projects);
});

// Wrap command with resource limits
function wrapCommand(command, maxCpu) {
  // Extract env vars from command (e.g., "VAR=value cmd")
  const envMatch = command.match(/^([\w_]+=\S+\s*)+/);
  const envVars = envMatch ? envMatch[0].trim() : '';
  const actualCommand = envMatch ? command.slice(envVars.length).trim() : command;

  if (maxCpu) {
    // Put env vars BEFORE systemd-run, not after --
    if (envVars) {
      return `${envVars} systemd-run --user --scope --property=CPUQuota=${maxCpu} -- ${actualCommand}`;
    }
    return `systemd-run --user --scope --property=CPUQuota=${maxCpu} -- ${command}`;
  }
  return command;
}

// API: Start project
app.post('/api/projects/:name/start', (req, res) => {
  const config = loadConfig();
  const project = config.projects.find(p => p.name === req.params.name);

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const wrappedCommand = wrapCommand(project.command, project.maxCpu);
  let pm2Cmd = `pm2 start "${wrappedCommand}" --name "${project.name}" --cwd "${project.path}" --no-autorestart`;

  // Add memory limit if configured
  if (project.maxMemory) {
    pm2Cmd += ` --max-memory-restart ${project.maxMemory}`;
  }

  exec(pm2Cmd, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: stderr || err.message });
    }
    refreshPM2Cache();
    res.json({ success: true, message: `Started ${project.name}` });
  });
});

// API: Stop project
app.post('/api/projects/:name/stop', (req, res) => {
  exec(`pm2 stop "${req.params.name}"`, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    refreshPM2Cache();
    res.json({ success: true, message: `Stopped ${req.params.name}` });
  });
});

// API: Restart project
app.post('/api/projects/:name/restart', (req, res) => {
  exec(`pm2 restart "${req.params.name}"`, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    refreshPM2Cache();
    res.json({ success: true, message: `Restarted ${req.params.name}` });
  });
});

// API: Get logs
app.get('/api/projects/:name/logs', (req, res) => {
  const cachedLogs = getCachedLogs(req.params.name);
  if (cachedLogs !== null) {
    return res.type('text').send(cachedLogs);
  }
  
  const lines = req.query.lines || LOGS_CACHE_LINES;
  try {
    const logs = execSync(`pm2 logs ${req.params.name} --lines ${lines} --nostream`, { encoding: 'utf8' });
    const cleanLogs = logs.replace(/\x1b\[[0-9;]*m/g, '');
    res.type('text').send(cleanLogs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Stop all projects
app.post('/api/projects/stop-all', (req, res) => {
  const config = loadConfig();
  const results = [];
  config.projects.forEach(p => {
    try {
      execSync(`pm2 stop "${p.name}"`);
      results.push({ name: p.name, success: true });
    } catch (err) {
      results.push({ name: p.name, success: false, error: err.message });
    }
  });
  refreshPM2Cache();
  res.json({ results });
});

// API: Restart all projects
app.post('/api/projects/restart-all', (req, res) => {
  const config = loadConfig();
  const results = [];
  config.projects.forEach(p => {
    try {
      execSync(`pm2 restart "${p.name}"`);
      results.push({ name: p.name, success: true });
    } catch (err) {
      results.push({ name: p.name, success: false, error: err.message });
    }
  });
  refreshPM2Cache();
  res.json({ results });
});

// SSE: Crash alerts
const lastRestarts = {};

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const interval = setInterval(() => {
    const config = loadConfig();
    if (!config.projects || config.projects.length === 0) return;

    const projectNames = config.projects.map(p => p.name);
    const statuses = getAllProjectStatuses(projectNames);

    const statusMap = {};
    statuses.forEach(s => { statusMap[s.name] = s; });
    updateProjectCpus(statuses);

    config.projects.forEach(p => {
      const status = statusMap[p.name];
      if (!status) return;
      const lastCount = lastRestarts[p.name] || 0;

      // Only alert on NEW restarts
      if (status.restarts > lastCount && status.restarts > 0) {
        res.write(`data: ${JSON.stringify({ type: 'restart', name: p.name, restarts: status.restarts })}\n\n`);
      }
      lastRestarts[p.name] = status.restarts;
    });
  }, 5000);

  req.on('close', () => clearInterval(interval));
});

// Dashboard HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Workspace Hub Dashboard running on port ${PORT}`);
  console.log(`Access at http://localhost:${PORT}`);
  
  refreshPM2Cache();
  setInterval(refreshPM2Cache, PM2_CACHE_TTL);
  
  // Logs are cached on-demand, no background refresh needed
});
