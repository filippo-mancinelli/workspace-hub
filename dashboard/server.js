const express = require('express');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 8080;
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, '../config/projects.json');

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

// Get PM2 status for a project
function getProjectStatus(name) {
  try {
    const output = execSync(`pm2 jlist`, { encoding: 'utf8' });
    const processes = JSON.parse(output);
    const proc = processes.find(p => p.name === name);
    if (proc) {
      return {
        status: proc.pm2_env.status,
        pid: proc.pid,
        cpu: proc.monit.cpu,
        memory: proc.monit.memory,
        uptime: proc.pm2_env.pm_uptime
      };
    }
    return { status: 'stopped' };
  } catch {
    return { status: 'stopped' };
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

// API: Start project
app.post('/api/projects/:name/start', (req, res) => {
  const config = loadConfig();
  const project = config.projects.find(p => p.name === req.params.name);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  exec(`pm2 start "${project.command}" --name "${project.name}" --cwd "${project.path}"`, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
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
  const lines = req.query.lines || 100;
  try {
    const logs = execSync(`pm2 logs ${req.params.name} --lines ${lines} --nostream`, { encoding: 'utf8' });
    res.type('text').send(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Workspace Hub Dashboard running on port ${PORT}`);
  console.log(`Access at http://localhost:${PORT}`);
});
