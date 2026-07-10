// ============================================================
//  TRASHCORE ULTRA — by TrashX
//  fetchPlugins.js  |  Fetches & hides core files from API
// ============================================================

const fs     = require('fs');
const path   = require('path');
const https  = require('https');
const http   = require('http');
const AdmZip = require('adm-zip');

// ─── config ──────────────────────────────────────────────────
const PLUGINS_API_URL = process.env.PLUGINS_API_URL || 'https://trashcore-plugins-api.onrender.com';
const PLUGINS_KEY     = process.env.PLUGINS_KEY     || 'trashcore-2025';

// ─── hidden paths ────────────────────────────────────────────
const LAYERS = ['l1','l2','l3','l4','l5','l6','l7','l8','l9','l10'];

const CORE_PATH = path.join(__dirname, 'node_modules', '.xcache', ...LAYERS);

const PLUGIN_DEEP_PATH = path.join(__dirname, 'plugins', ...LAYERS);

global.__CORE__    = CORE_PATH;
global.__PLUGINS__ = PLUGIN_DEEP_PATH;
global.__ROOT__    = __dirname;  // bot root — for config.js─────────────────────────────────────────────────────────────

function log(msg)  { console.log(`»  \x1b[36m[FETCH]\x1b[0m ${msg}`); }
function err(msg)  { console.log(`»  \x1b[31m[FETCH]\x1b[0m ${msg}`); }

// ─── download with redirect support ──────────────────────────
function downloadBuffer(url, headers = {}, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));

    const parsed  = new URL(url);
    const client  = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers:  { 'User-Agent': 'TrashcoreBot/1.0', ...headers }
    };

    const req = client.request(options, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        return resolve(downloadBuffer(res.headers.location, headers, redirectCount + 1));
      }
      if (res.statusCode === 403) return reject(new Error('Invalid PLUGINS_KEY — access denied'));
      if (res.statusCode === 401) return reject(new Error('Missing PLUGINS_KEY'));
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end',  () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

// ─── extract zip into correct hidden paths ───────────────────
function extractFiles(zipBuffer) {
  const zip     = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  let prefix = '';
  for (const entry of entries) {
    if (entry.isDirectory && entry.entryName.split('/').length === 2) {
      prefix = entry.entryName;
      break;
    }
  }

  if (fs.existsSync(CORE_PATH))        fs.rmSync(CORE_PATH,        { recursive: true, force: true });
  if (fs.existsSync(PLUGIN_DEEP_PATH)) fs.rmSync(PLUGIN_DEEP_PATH, { recursive: true, force: true });

  fs.mkdirSync(CORE_PATH,        { recursive: true });
  fs.mkdirSync(PLUGIN_DEEP_PATH, { recursive: true });
  const xcacheRoot = path.join(__dirname, 'node_modules', '.xcache');
  fs.writeFileSync(path.join(xcacheRoot, '.gitignore'), '*\n');
  fs.writeFileSync(path.join(xcacheRoot, '.npmignore'), '*\n');

  let coreCount   = 0;
  let pluginCount = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    let relPath = entry.entryName;
    if (prefix && relPath.startsWith(prefix)) relPath = relPath.slice(prefix.length);
    if (!relPath) continue;
    if (relPath.startsWith('plugins/')) {
      const pluginRel = relPath.slice('plugins/'.length); // strip "plugins/"
      const destPath  = path.join(PLUGIN_DEEP_PATH, pluginRel);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, entry.getData());
      pluginCount++;
    } else {
      const destPath = path.join(CORE_PATH, relPath);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, entry.getData());
      coreCount++;
    }
  }

  return { coreCount, pluginCount };
}

// ─── main export ─────────────────────────────────────────────
async function fetchCore() {
  if (!PLUGINS_KEY) {
    err('PLUGINS_KEY missing — contact bot owner');
    process.exit(1);
  }

  log('Fetching core files...');

  try {
    const zipBuffer = await downloadBuffer(PLUGINS_API_URL, {
      'x-bot-key': PLUGINS_KEY
    });

    log(`Downloaded ${(zipBuffer.length / 1024).toFixed(1)} KB`);

    const { coreCount, pluginCount, sha } = extractFiles(zipBuffer);
    log(`✅ Core files  → node_modules/.xcache/l1/.../l10/ (${coreCount} files)`);
    log(`✅ Plugin files → plugins/l1/.../l10/ (${pluginCount} files)`);
    if (sha) {
      try { fs.writeFileSync(path.join(__dirname, '.version'), sha, 'utf8'); } catch {}
    }

  } catch (e) {
    err(`Failed to fetch core: ${e.message}`);
    process.exit(1);
  }
}

module.exports = fetchCore;
