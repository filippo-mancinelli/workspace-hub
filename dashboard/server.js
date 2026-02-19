const express = require('express');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 8080;
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, '../config/projects.json');

const LOGS_CACHE_TTL = 2000;
const LOGS_CACHE_LINES = 200;

const logsCache = new Map();

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

// Get PM2 status for a project
function getProjectStatus(name) {
  try {
    const output = execSync(`pm2 jlist`, { encoding: 'utf8' });
    const processes = JSON.parse(output);
    const proc = processes.find(p => p.name === name);
    if (proc) {
      // Get real CPU from ps using PID (PM2 monitoring is unreliable)
      let cpu = proc.monit.cpu;
      if (proc.pid) {
        try {
          const psCpu = execSync(`ps -p ${proc.pid} -o %cpu --no-headers 2>/dev/null`, { encoding: 'utf8' }).trim();
          if (psCpu) cpu = parseFloat(psCpu);
        } catch {}
      }
      return {
        status: proc.pm2_env.status,
        pid: proc.pid,
        cpu: cpu,
        memory: proc.monit.memory,
        uptime: proc.pm2_env.pm_uptime,
        restarts: proc.pm2_env.restart_time || 0
      };
    }
    return { status: 'stopped', restarts: 0, cpu: 0 };
  } catch {
    return { status: 'stopped', restarts: 0, cpu: 0 };
  }
}

// API: List all projects with status
app.get('/api/projects', (req, res) => {
  const config = loadConfig();
  const projects = config.projects.map(p => ({
    ...p,
    ...getProjectStatus(p.name)
  }));
  res.json(projects);
});

// Wrap command with resource limits
function wrapCommand(command, maxCpu) {
  if (maxCpu) {
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
    res.json({ success: true, message: `Started ${project.name}` });
  });
});

// API: Stop project
app.post('/api/projects/:name/stop', (req, res) => {
  exec(`pm2 stop "${req.params.name}"`, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, message: `Stopped ${req.params.name}` });
  });
});

// API: Restart project
app.post('/api/projects/:name/restart', (req, res) => {
  exec(`pm2 restart "${req.params.name}"`, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
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
    config.projects.forEach(p => {
      const status = getProjectStatus(p.name);
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
  
  updateLogsCache();
  setInterval(updateLogsCache, LOGS_CACHE_TTL);
});
