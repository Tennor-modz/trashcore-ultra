// ============================================================
//  ULTRA X PROJECT — by TrashX
//  index.js  |  Steal if you want 😂
// ============================================================

const fs        = require('fs');
const path      = require('path');
const pino      = require('pino');
const chalk     = require('chalk');
const readline  = require('readline');
const NodeCache = require('node-cache');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  jidNormalizedUser
} = require('@trashcore/baileys');

const fetchCore = require('./fetchPlugins');
const config    = require('./config');

// ─── Dashboard ───────────────────────────────────────────────
const {
  startDashboard,
  updateStats,
  incrementMessages,
  incrementCommands,
} = require('./dashboard');

// ─── LAYERS path helper ──────────────────────────────────────
const LAYERS = ['l1','l2','l3','l4','l5','l6','l7','l8','l9','l10'];
const CORE_PATH   = require('path').join(__dirname, 'node_modules', '.xcache', ...LAYERS);
const PLUGIN_PATH = require('path').join(__dirname, 'plugins', ...LAYERS);
global.__CORE__    = CORE_PATH;
global.__PLUGINS__ = PLUGIN_PATH;

let loadPlugins, watchPlugins, plugins;
let initDatabase, getSetting, setSetting;
let logMessage;

global.botStartTime = Date.now();
let dbReady      = false;
let trashcoreRef = null;

// ─── Start HTTP dashboard ─────────────────────────────────────
startDashboard();

// ─── console logger ──────────────────────────────────────────

const C = {
  arrow:     chalk.hex('#ff6ac1').bold,       // hot pink »

  // DM colors
  dmBar:     chalk.hex('#00ffe0'),             // cyan
  dmHeader:  chalk.hex('#00ffe0').bold,
  dmLabel:   chalk.hex('#a0a8c8'),             // muted blue-gray
  dmValue:   chalk.hex('#ffffff'),
  dmName:    chalk.hex('#ffdd57').bold,        // yellow sender
  dmMsg:     chalk.hex('#ff9f43'),             // orange message

  // GC colors
  gcBar:     chalk.hex('#bd93f9'),             // purple
  gcHeader:  chalk.hex('#bd93f9').bold,
  gcLabel:   chalk.hex('#a0a8c8'),
  gcValue:   chalk.hex('#ffffff'),
  gcName:    chalk.hex('#50fa7b').bold,        // green sender
  gcGroup:   chalk.hex('#ff79c6'),             // pink group name
  gcMsg:     chalk.hex('#8be9fd'),             // sky blue message

  // SYS/ERR
  sysBar:    chalk.hex('#ffb86c'),
  sysHeader: chalk.hex('#ffb86c').bold,
  sysValue:  chalk.hex('#f1fa8c'),
  errBar:    chalk.hex('#ff5555'),
  errHeader: chalk.hex('#ff5555').bold,
  errValue:  chalk.hex('#ff5555'),
  okHeader:  chalk.hex('#50fa7b').bold,
  okValue:   chalk.hex('#50fa7b'),

  time:      chalk.hex('#6272a4'),
  dim:       chalk.hex('#44475a'),
  bold:      chalk.hex('#f8f8f2').bold,
};

// ── EAT = UTC+3 ──────────────────────────────────────────────
function nowTs() {
  const now  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
  const day  = now.toLocaleDateString('en-GB', { weekday: 'long' });
  const date = now.toLocaleDateString('en-GB');
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return { day, date, time, full: `${day}, ${time}` };
}

function hbar(colorFn, char = '─', len = 48) {
  return colorFn(char.repeat(len));
}

// ── Utility log lines ─────────────────────────────────────────
function logOk(msg)   { console.log(`${C.arrow('»')}  ${C.okHeader('[OK]')}   ${C.okValue(msg)}`); }
function logSys(msg)  { console.log(`${C.arrow('»')}  ${C.sysHeader('[SYS]')}  ${C.sysValue(msg)}`); }
function logWarn(msg) { console.log(`${C.arrow('»')}  ${C.sysHeader('[WARN]')} ${C.sysValue(msg)}`); }
function logErr(msg)  { console.log(`${C.arrow('»')}  ${C.errHeader('[ERR]')}  ${C.errValue(msg)}`); }

function logReconnect() {
  console.log('');
  console.log(hbar(C.sysBar, '─', 56));
  console.log(`${C.arrow('»')}  ${C.sysHeader('Connection closed — reconnecting in 3s...')}`);
  console.log(hbar(C.sysBar, '─', 56));
  console.log('');
}

function logLoggedOut() {
  console.log('');
  console.log(hbar(C.errBar, '─', 56));
  logErr('Logged out. Delete session folder and restart.');
  console.log(hbar(C.errBar, '─', 56));
  console.log('');
}

// ── Startup banner ────────────────────────────────────────────
function printBanner() {
  console.log('');
  console.log(C.gcBar('  ╔' + '═'.repeat(52) + '╗'));
  console.log(C.gcBar('  ║') + C.bold('        ⚡ TRASHCORE ULTRA  —  by TrashX        ') + C.gcBar('║'));
  console.log(C.gcBar('  ╚' + '═'.repeat(52) + '╝'));
  console.log('');
}

// ── Connected stats box ───────────────────────────────────────
function printConnected(botNumber, groupCount, chatCount, pluginCount, prefix) {
  const uptime = formatUptime(Date.now() - global.botStartTime);
  const A = C.arrow('»');
  console.log('');
  console.log(hbar(C.dmBar, '═', 56));
  console.log(`${A}  ${C.dmHeader('STATUS')}        ${chalk.hex('#50fa7b').bold('ONLINE ●')}`);
  console.log(`${A}  ${C.dmLabel('Number:')}      ${chalk.hex('#ffdd57').bold('+' + botNumber)}`);
  console.log(`${A}  ${C.dmLabel('Groups:')}      ${chalk.hex('#ff79c6').bold(String(groupCount))}`);
  console.log(`${A}  ${C.dmLabel('Chats:')}       ${chalk.hex('#8be9fd').bold(String(chatCount))}`);
  console.log(`${A}  ${C.dmLabel('Plugins:')}     ${chalk.hex('#50fa7b').bold(String(pluginCount))}`);
  console.log(`${A}  ${C.dmLabel('Prefix:')}      ${chalk.hex('#ffb86c').bold(prefix)}`);
  console.log(`${A}  ${C.dmLabel('Uptime:')}      ${C.time(uptime)}`);
  console.log(hbar(C.dmBar, '═', 56));
  console.log('');
}

// ─── in-memory caches ────────────────────────────────────────
const groupCache    = new NodeCache({ stdTTL: 120, checkperiod: 60 });
const settingsCache = new NodeCache({ stdTTL: 30,  checkperiod: 15 });

function getCachedSetting(key, defaultValue = null) {
  const hit = settingsCache.get(key);
  if (hit !== undefined) return hit;
  const val = getSetting ? getSetting(key, defaultValue) : defaultValue;
  settingsCache.set(key, val);
  return val;
}

function setCachedSetting(key, value) {
  settingsCache.del(key);
  if (setSetting) setSetting(key, value);
}
global.setSetting = setCachedSetting;

async function getGroupMeta(trashcore, chatId) {
  const hit = groupCache.get(chatId);
  if (hit) return hit;
  try {
    const meta = await trashcore.groupMetadata(chatId);
    if (meta) groupCache.set(chatId, meta);
    return meta || {};
  } catch {
    return {};
  }
}

function invalidateGroupCache(chatId) {
  groupCache.del(chatId);
}

global.getGroupMeta         = getGroupMeta;
global.invalidateGroupCache = invalidateGroupCache;

// ─── message queue ───────────────────────────────────────────
const QUEUE_CONCURRENCY = 5;
let   activeWorkers     = 0;
const messageQueue      = [];

function enqueueMessage(handler) {
  messageQueue.push(handler);
  drainQueue();
}

function drainQueue() {
  while (activeWorkers < QUEUE_CONCURRENCY && messageQueue.length > 0) {
    const handler = messageQueue.shift();
    activeWorkers++;
    handler().finally(() => {
      activeWorkers--;
      drainQueue();
    });
  }
}

// ─── helpers ─────────────────────────────────────────────────

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m ${s % 60}s`;
}

function normalizeNumber(jid) {
  return jid ? jid.split('@')[0].split(':')[0] : '';
}

const CREATOR_NUMBER = '254104245659';

function isSudoUser(bareNumber) {
  if (bareNumber === CREATOR_NUMBER) return true;
  if (!getSetting) return false;
  const list = getSetting('sudoUsers', []);
  const now  = Date.now();
  return list.some(e => e.number === bareNumber && (!e.expiresAt || e.expiresAt > now));
}

function cleanOldCache() {
  const cacheFolder = path.join(__dirname, 'cache');
  if (!fs.existsSync(cacheFolder)) return;
  for (const file of fs.readdirSync(cacheFolder)) {
    try { fs.unlinkSync(path.join(cacheFolder, file)); } catch {}
  }
}

function question(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans.trim()); }));
}

function getHandleMessage() {
  const cmdPath = require('path').join(global.__CORE__, 'command.js');
  delete require.cache[require.resolve(cmdPath)];
  return require(cmdPath);
}

// ─── Registry auto-sync ──────────────────────────────────────

const REGISTRY_SYNC_URL      = 'https://raw.githubusercontent.com/Tennor-modz/trashcore-ultra/main/extPluginRegistry.json';
const REGISTRY_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const REGISTRY_LOCAL_PATH    = path.join(__dirname, 'extPluginRegistry.json');

function startRegistrySync() {
  async function syncRegistry() {
    try {
      const https  = require('https');
      const data   = await new Promise((resolve, reject) => {
        const req = https.get(REGISTRY_SYNC_URL, { headers: { 'User-Agent': 'TrashcoreBot/1.0' } }, (res) => {
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')));
          res.on('error', reject);
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
      });

      // Validate it's real JSON before writing
      JSON.parse(data);

      // Compare with local — only write if changed
      let local = '';
      try { local = fs.readFileSync(REGISTRY_LOCAL_PATH, 'utf8'); } catch {}

      if (data.trim() !== local.trim()) {
        fs.writeFileSync(REGISTRY_LOCAL_PATH, data, 'utf8');
        logOk('[RegistrySync] extPluginRegistry.json updated from GitHub ✅');
      }
    } catch (e) {
      logWarn(`[RegistrySync] Failed to sync registry: ${e.message}`);
    }
  }

  // Run once immediately, then on interval
  syncRegistry();
  setInterval(syncRegistry, REGISTRY_SYNC_INTERVAL);
  logOk('Registry auto-sync started (every 5 min)');
}



const SESSION_CLEANUP_INTERVAL_MS = 2 * 60 * 60 * 1000;  // 2 hours
const SESSION_KEY_MAX_AGE_MS      = 48 * 60 * 60 * 1000; // 48 hours

function startSessionKeyCleanup() {
  setInterval(() => {
    try {
      if (!fs.existsSync(sessionDir)) return;
      const files = fs.readdirSync(sessionDir);
      const now   = Date.now();
      let deleted = 0;

      for (const file of files) {
        if (file === 'creds.json') continue;
        const isSignalFile =
          file.startsWith('pre-key') ||
          file.startsWith('sender-key') ||
          file.startsWith('session-') ||
          file.startsWith('app-state');
        if (!isSignalFile) continue;

        const filePath = path.join(sessionDir, file);
        try {
          const { mtimeMs } = fs.statSync(filePath);
          if (now - mtimeMs > SESSION_KEY_MAX_AGE_MS) {
            fs.unlinkSync(filePath);
            deleted++;
          }
        } catch {}
      }

      if (deleted > 0) {
        logSys(`[Session Cleanup] Removed ${deleted} stale signal key file(s)`);
      }
    } catch (err) {
      logErr(`[Session Cleanup] ${err.message}`);
    }
  }, SESSION_CLEANUP_INTERVAL_MS);

  logOk('Session key cleanup scheduler started (every 2h, max age 48h)');
}

// ─── middleware: antilink ────────────────────────────────────

async function runAntilink(trashcore, m) {
  try {
    const chatId = m.key.remoteJid;
    if (!chatId?.endsWith('@g.us')) return false;

    const body =
      m.message?.conversation ||
      m.message?.extendedTextMessage?.text ||
      m.message?.imageMessage?.caption ||
      m.message?.videoMessage?.caption || '';

    if (!body) return false;

    const senderJid  = m.key.participant || chatId;
    const antilinkgc = getCachedSetting(`antilinkgc_${chatId}`, false);
    const antilink   = getCachedSetting(`antilink_${chatId}`,   false);
    if (!antilinkgc && !antilink) return false;

    const botNumber  = normalizeNumber(trashcore.user.id);
    const senderBareNum = normalizeNumber(senderJid);
    const isOwner    = senderBareNum === botNumber || isSudoUser(senderBareNum);
    const fromMe     = m.key.fromMe === true;
    if (isOwner || fromMe) return false;

    const meta       = await getGroupMeta(trashcore, chatId);
    const senderBare = senderBareNum;
    const p          = (meta.participants || []).find(x => normalizeNumber(x.id) === senderBare);
    const isAdmin    = p?.admin === 'admin' || p?.admin === 'superadmin';
    if (isAdmin) return false;

    if (antilinkgc && body.includes('chat.whatsapp.com')) {
      await trashcore.sendMessage(chatId, {
        delete: { remoteJid: chatId, fromMe: false, id: m.key.id, participant: m.key.participant }
      });
      trashcore.sendMessage(chatId, {
        text: `\`\`\`「 GC Link Detected 」\`\`\`\n\n@${senderJid.split('@')[0]} sent a group link and it was deleted.`,
        mentions: [senderJid]
      }, { quoted: m }).catch(() => {});
      logSys(`Antilink: deleted GC link from ${normalizeNumber(senderJid)}`);
      return true;
    }

    if (antilink && body.includes('http')) {
      await trashcore.sendMessage(chatId, {
        delete: { remoteJid: chatId, fromMe: false, id: m.key.id, participant: m.key.participant }
      });
      trashcore.sendMessage(chatId, {
        text: `\`\`\`「 Link Detected 」\`\`\`\n\n@${senderJid.split('@')[0]} sent a link and it was deleted.`,
        mentions: [senderJid]
      }, { quoted: m }).catch(() => {});
      logSys(`Antilink: deleted link from ${normalizeNumber(senderJid)}`);
      return true;
    }

    return false;
  } catch (err) {
    logErr(`[antilink] ${err.message}`);
    return false;
  }
}

// ─── middleware: auto presence ───────────────────────────────

function runAutoPresence(trashcore, m) {
  try {
    const chatId     = m.key.remoteJid;
    const autoTyping = getCachedSetting('autoTyping', false);
    const autoRecord = getCachedSetting('autoRecord', false);
    if (autoTyping) trashcore.sendPresenceUpdate('composing', chatId).catch(() => {});
    if (autoRecord) trashcore.sendPresenceUpdate('recording', chatId).catch(() => {});
    trashcore.sendPresenceUpdate('available', chatId).catch(() => {});
  } catch {}
}

// ─── middleware: autobio ─────────────────────────────────────

let lastBioUpdate = 0;
function runAutoBio(trashcore) {
  try {
    const autobio = getCachedSetting('autoBio', false);
    if (!autobio) return;
    const now = Date.now();
    if (now - lastBioUpdate < 60000) return;
    lastBioUpdate = now;
    const uptime = formatUptime(now - global.botStartTime);
    trashcore.updateProfileStatus(`✳️ TRASHCORE BOT || ✅ Runtime: ${uptime}`).catch(() => {});
  } catch {}
}

// ─── group-participants.update ───────────────────────────────

async function handleGroupParticipants(trashcore, update) {
  try {
    const { id, participants, action } = update;

    invalidateGroupCache(id);

    const isWelcomeOn = getCachedSetting(`welcome_${id}`, false);
    const isGoodbyeOn = getCachedSetting(`goodbye_${id}`,  false);
    if (action === 'add'    && !isWelcomeOn) return;
    if (action === 'remove' && !isGoodbyeOn) return;

    const meta = await getGroupMeta(trashcore, id);
    if (!meta) return;

    const groupName   = meta.subject || 'this group';
    const memberCount = meta.participants?.length || 0;
    const axios       = require('axios');

    for (const jid of participants) {
      const num = jid.split('@')[0];

      let ppUser = null;
      try {
        const ppUrl = await trashcore.profilePictureUrl(jid, 'image');
        const res   = await axios.get(ppUrl, { responseType: 'arraybuffer', timeout: 8000 });
        ppUser      = Buffer.from(res.data);
      } catch {
        try {
          const res = await axios.get('https://i.ibb.co/Kj7J3Rg/default-avatar.jpg', { responseType: 'arraybuffer', timeout: 8000 });
          ppUser    = Buffer.from(res.data);
        } catch { ppUser = null; }
      }

      const ppUrl = await trashcore.profilePictureUrl(jid, 'image').catch(() => '');

      if (action === 'add' && isWelcomeOn) {
        await trashcore.sendMessage(id, {
          image:   ppUser || { url: 'https://i.ibb.co/Kj7J3Rg/default-avatar.jpg' },
          caption:
            `╔══════════════════╗\n` +
            `║   👋 *WELCOME!*   ║\n` +
            `╚══════════════════╝\n\n` +
            `@${num} just joined the group!\n\n` +
            `• *Group*   : ${groupName}\n` +
            `• *Members* : ${memberCount}\n\n` +
            `_Welcome to the family! 🎉_`,
          mentions: [jid],
          contextInfo: {
            externalAdReply: {
              title: `☘️ Welcome, @${num}!`, body: groupName,
              thumbnailUrl: ppUrl, sourceUrl: 'https://github.com/Tennor-modz/trashcore-ultra',
              mediaType: 1, renderLargerThumbnail: true
            }
          }
        });
        logSys(`Welcome sent → ${num} in ${groupName}`);
      }

      if (action === 'remove' && isGoodbyeOn) {
        await trashcore.sendMessage(id, {
          image:   ppUser || { url: 'https://i.ibb.co/Kj7J3Rg/default-avatar.jpg' },
          caption:
            `╔══════════════════╗\n` +
            `║   👋 *GOODBYE!*   ║\n` +
            `╚══════════════════╝\n\n` +
            `@${num} has left the group.\n\n` +
            `• *Group*   : ${groupName}\n` +
            `• *Members* : ${memberCount}\n\n` +
            `_Thanks for being with us. We'll miss you! 💙_`,
          mentions: [jid],
          contextInfo: {
            externalAdReply: {
              title: `☘️ Goodbye, @${num}!`, body: groupName,
              thumbnailUrl: ppUrl, sourceUrl: 'https://github.com/Tennor-modz/trashcore-ultra',
              mediaType: 1, renderLargerThumbnail: true
            }
          }
        });
        logSys(`Goodbye sent → ${num} left ${groupName}`);
      }
    }
  } catch (err) {
    logErr(`[welcome/goodbye] ${err.message}`);
  }
}

// ─── session helpers ─────────────────────────────────────────

const sessionDir = path.join(__dirname, 'session');
const credsPath  = path.join(sessionDir, 'creds.json');

async function saveSessionFromConfig() {
  try {
    if (!config.SESSION_ID || !config.SESSION_ID.includes('trashcore~')) return false;
    const base64Data = config.SESSION_ID.split('trashcore~')[1];
    if (!base64Data) return false;
    await fs.promises.mkdir(sessionDir, { recursive: true });
    await fs.promises.writeFile(credsPath, Buffer.from(base64Data, 'base64'));
    logOk('Session saved from SESSION_ID');
    return true;
  } catch (err) {
    logErr(`Failed to save session: ${err.message}`);
    return false;
  }
}

// ─── main bot ────────────────────────────────────────────────

let _coreLoaded = false;

async function starttrashcore() {
  if (!_coreLoaded) {
    await fetchCore();

    const p = require('path');
    const LAYERS = ['l1','l2','l3','l4','l5','l6','l7','l8','l9','l10'];
    global.__CORE__    = p.join(__dirname, 'node_modules', '.xcache', ...LAYERS);
    global.__PLUGINS__ = p.join(__dirname, 'plugins', ...LAYERS);

    // ── load core modules from hidden cache ─────────────────────
    const COREDIR = global.__CORE__;
    ({ loadPlugins, watchPlugins, plugins } = require(p.join(COREDIR, 'pluginStore')));
    ({ initDatabase, getSetting, setSetting } = require(p.join(COREDIR, 'database')));
    ({ logMessage } = require(p.join(COREDIR, 'database', 'logger')));

    loadPlugins();
    watchPlugins();
    logOk(`Loaded ${plugins.size} plugins`);
    _coreLoaded = true;

    
    startSessionKeyCleanup();
    startRegistrySync();
  }

  const { state, saveCreds } = await useMultiFileAuthState('./session');
  const { version }          = await fetchLatestBaileysVersion();

  const msgRetryCounterCache = new NodeCache();

  const trashcore = makeWASocket({
    version,
    keepAliveIntervalMs: 30000,
    printQRInTerminal:   false,
    logger: pino({ level: 'silent' }),
    auth: {
      creds: state.creds,
      keys:  makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    browser:             ['Ubuntu', 'Chrome', '120.0.0.0'],
    syncFullHistory:     false,
    markOnlineOnConnect: false,
    msgRetryCounterCache,                    
  });

  trashcoreRef = trashcore;
  trashcore.ev.on('creds.update', saveCreds);

  // Store
  const createToxxicStore = require(require('path').join(global.__CORE__, 'basestore'));
  const store = createToxxicStore('./store', { maxMessagesPerChat: 50, memoryOnly: true });
  store.bind(trashcore.ev);

  // Pairing
  if (!state.creds.registered && (!config.SESSION_ID || config.SESSION_ID === '')) {
    try {
      const phoneNumber = await question(C.sysValue('[ = ] Enter your WhatsApp number (with country code):\n'));
      const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
      console.clear();
      printBanner();
      const pairCode = await trashcore.requestPairingCode(cleanNumber, 'TRASHBOT');
      console.log('');
      console.log(`${C.arrow('»')}  ${C.bold('Pairing Code:')}  ${chalk.hex('#ffdd57').bold(pairCode)}`);
      console.log(`${C.arrow('»')}  ${C.time('Approve on your phone...')}`);
      console.log('');
    } catch (err) {
      logErr(`Pairing failed: ${err.message}`);
    }
  }

  // ─── connection.update ───────────────────────────────────
  trashcore.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        updateStats({ status: 'reconnecting' });
        logReconnect();
        setTimeout(() => starttrashcore(), 3000);
      } else {
        updateStats({ status: 'offline' });
        logLoggedOut();
      }
    }

    if (connection === 'open') {
      const botNumber = normalizeNumber(trashcore.user.id);

      await initDatabase();
      dbReady = true;
      cleanOldCache();

      const prefix = getCachedSetting('prefix', '.');

      // Count groups and chats from store
      let groupCount = 0;
      let chatCount  = 0;
      try {
        const allChats = store.chats?.all?.() || [];
        chatCount  = allChats.length;
        groupCount = allChats.filter(c => c.id?.endsWith('@g.us')).length;
      } catch {}

      // ── Push live stats to dashboard ──────────────────────────
      updateStats({
        status:      'online',
        botNumber,
        groupCount,
        chatCount,
        pluginCount: plugins.size,
        prefix,
        connectedAt: Date.now(),
      });

      printConnected(botNumber, groupCount, chatCount, plugins.size, prefix);

      trashcore.sendMessage(`${botNumber}@s.whatsapp.net`, {
        text:
          `💠 *TRASHCORE ULTRA ACTIVATED!*\n\n` +
          `> ❐ Prefix  : ${prefix}\n` +
          `> ❐ Plugins : ${plugins.size}\n` +
          `> ❐ Number  : wa.me/${botNumber}\n` +
          `✓ Uptime: _${formatUptime(Date.now() - global.botStartTime)}_`
      }).catch(() => {});

      // AntiDelete
      // Ensure database folder exists in bot root for json files
      const dbDir = require('path').join(__dirname, 'database');
      if (!require('fs').existsSync(dbDir)) require('fs').mkdirSync(dbDir, { recursive: true });

      const initAntiDelete = require(require('path').join(global.__CORE__, 'database', 'antiDelete'));
      initAntiDelete(trashcore, {
        botNumber: `${botNumber}@s.whatsapp.net`,
        dbPath:    require('path').join(__dirname, 'database', 'antidelete.json'),
        enabled:   true
      });
      logOk('AntiDelete active');

      // AntiViewOnce — only init once to prevent duplicate listeners on reconnect
      if (!global._antiViewOnce) {
        const initAntiViewOnce = require(require('path').join(global.__CORE__, 'database', 'antiViewOnce'));
        global._antiViewOnce = initAntiViewOnce(trashcore, {
          botNumber: `${botNumber}@s.whatsapp.net`,
          enabled:   true
        });
        logOk('AntiViewOnce active');
      }
    }
  });

  // ─── messages.upsert ─────────────────────────────────────
  trashcore.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify' || !dbReady) return;

    for (const m of messages) {
      if (!m?.message) continue;

      enqueueMessage(async () => {
        try {
          // Status view
          if (m.key.remoteJid === 'status@broadcast') {
            const enabled = getCachedSetting('statusView', true);
            if (enabled) trashcore.readMessages([m.key]).catch(() => {});
            return;
          }

          // Unwrap ephemeral
          if (m.message?.ephemeralMessage) m.message = m.message.ephemeralMessage.message;

          // Presence & bio
          runAutoPresence(trashcore, m);
          runAutoBio(trashcore);

          // Antilink
          const deleted = await runAntilink(trashcore, m);
          if (deleted) return;

          // Warn message counter — kick warned users after 3 messages
          try {
            const { checkWarnedUser } = require(require('path').join(global.__CORE__, 'plugins', 'group', 'group2'));
            await checkWarnedUser(trashcore, m);
          } catch (e) {
            // warn check failed silently
          }

          // Auto-read
          const autoReadMode = getCachedSetting('autoRead', false);
          if (autoReadMode) {
            const isGroupMsg = m.key.remoteJid.endsWith('@g.us');
            const shouldRead =
              autoReadMode === 'all' ||
              (autoReadMode === 'gc' && isGroupMsg) ||
              (autoReadMode === 'pc' && !isGroupMsg);
            if (shouldRead) trashcore.readMessages([m.key]).catch(() => {});
          }

          // Auto-react to creator
          const CREATOR_NUMBER = '254104245659';
          const msgSenderJid = m.key.participant || m.key.remoteJid;
          const msgSenderNum = msgSenderJid ? msgSenderJid.split('@')[0].split(':')[0] : '';
          if (msgSenderNum === CREATOR_NUMBER) {
            trashcore.sendMessage(m.key.remoteJid, {
              react: { text: '🥇', key: m.key }
            }).catch(() => {});
          }

          // ── Log + dispatch ───────────────────────────────
          incrementMessages();
          await logMessage(m, trashcore);
          const result = await getHandleMessage()(trashcore, m);
          if (result !== false) incrementCommands();

        } catch (err) {
          logErr(`[messages.upsert] ${err.message}`);
        }
      });
    }
  });

  // ─── group-participants.update ───────────────────────────
  trashcore.ev.on('group-participants.update', async (update) => {
    if (!dbReady) return;
    handleGroupParticipants(trashcore, update).catch(err =>
      logErr(`[group-participants] ${err.message}`)
    );
  });
}

// ─── entry point ─────────────────────────────────────────────

async function sessionID() {
  printBanner();
  try {
    await fs.promises.mkdir(sessionDir, { recursive: true });

    if (fs.existsSync(credsPath)) {
      logOk('Existing session found. Starting...');
      await starttrashcore();
      return;
    }

    if (config.SESSION_ID && config.SESSION_ID.includes('trashcore~')) {
      const ok = await saveSessionFromConfig();
      if (ok) {
        logOk('SESSION_ID loaded. Starting...');
        await starttrashcore();
        return;
      }
      logWarn('SESSION_ID failed. Falling back to pairing...');
    }

    logWarn('No session found. Starting pairing flow...');
    await starttrashcore();
  } catch (error) {
    logErr(`Startup error: ${error.message}`);
  }
}

sessionID();
