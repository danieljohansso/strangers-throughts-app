const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 3922;
const BASE_URL = `http://localhost:${PORT}`;
const TEMP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'stranger-smoke-'));

function copyDataSeed() {
  const sourceDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(sourceDir)) return;

  for (const fileName of ['quotes.json', 'reactions.json', 'reports.json']) {
    const source = path.join(sourceDir, fileName);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(TEMP_DATA_DIR, fileName));
    }
  }
}

function request(path, options = {}) {
  const body = options.body ? JSON.stringify(options.body) : null;

  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {})
      }
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 8000) {
    try {
      const res = await request('/');
      if (res.status === 200) return;
    } catch (err) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw new Error('Server did not start within 8 seconds');
}

async function main() {
  copyDataSeed();

  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), DATA_DIR: TEMP_DATA_DIR },
    stdio: 'pipe'
  });

  try {
    await waitForServer();

    const reportResult = await request('/api/reports', {
      method: 'POST',
      body: { quoteId: 'smoke-test', reason: 'smoke verification', reporterId: 'smoke' }
    });
    const reportsResult = await request('/api/reports');
    const reports = JSON.parse(reportsResult.body);
    const smokeReport = reports.find(report => report.quoteId === 'smoke-test');
    if (smokeReport) {
      await request(`/api/reports/${smokeReport.id}`, { method: 'DELETE' });
    }

    const checks = [
      ['home', await request('/')],
      ['app js', await request('/app.js')],
      ['pricing', await request('/pricing.html')],
      ['admin', await request('/admin.html')],
      ['stats', await request('/api/stats')],
      ['export', await request('/api/export')],
      ['report', reportResult],
      ['reports list', reportsResult]
    ];

    const failed = checks.filter(([, res]) => res.status < 200 || res.status >= 300);
    if (failed.length > 0) {
      throw new Error(`Smoke checks failed: ${failed.map(([name, res]) => `${name}=${res.status}`).join(', ')}`);
    }

    console.log('Smoke checks passed:', checks.map(([name]) => name).join(', '));
  } finally {
    child.kill();
    fs.rmSync(TEMP_DATA_DIR, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
