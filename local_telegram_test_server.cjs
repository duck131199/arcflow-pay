const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const STATE_PATH = path.join(__dirname, '.local-telegram-state.json');
let state = loadState();
if (!state.sentInvoiceAlerts) state.sentInvoiceAlerts = {};
if (!state.sentPaymentAlerts) state.sentPaymentAlerts = {};

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.bots) return parsed;
    if (parsed && parsed.token && parsed.bot) return { active: 'default', bots: { default: parsed } };
  } catch {}
  return { active: null, bots: {}, sentInvoiceAlerts: {}, sentPaymentAlerts: {} };
}
function saveState() { fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2)); }
function keyFrom(body = {}, url) { return String(body.arqis_username || body.username || url.searchParams.get('arqis_username') || state.active || 'default').replace(/^@/, '').trim().toLowerCase() || 'default'; }
function publicState(key) {
  const connected = state.bots[key] || null;
  if (!connected) return { connected: false, tested: false };
  return {
    connected: true,
    tested: !!connected.testedAt,
    arqis_username: connected.arqisUsername || key,
    bot: connected.bot ? { id: connected.bot.id, username: connected.bot.username, first_name: connected.bot.first_name } : null,
    connected_at: connected.connectedAt || null,
    tested_at: connected.testedAt || null,
  };
}
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' });
  res.end(JSON.stringify(body));
}
function validToken(token) { const value = String(token || '').trim(); return value.length >= 20 && value.includes(':'); }
async function telegram(token, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) { const err = new Error(data.description || `Telegram ${method} failed`); err.details = data; throw err; }
  return data.result;
}
async function resolveChatId(token, explicitChatId) {
  if (explicitChatId) return String(explicitChatId).trim().replace(/^telegram:/i, '');
  const updates = await telegram(token, 'getUpdates', { limit: 30, timeout: 0, allowed_updates: ['message'] });
  const start = [...updates].reverse().find((u) => u.message && u.message.chat && String(u.message.text || '').startsWith('/start'));
  return start ? String(start.message.chat.id) : '';
}
function fmtDate(v) { const d = new Date(String(v || '')); return Number.isFinite(d.getTime()) ? d.toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '-'; }
function shortAddr(addr) { const s = String(addr || ''); return s.length > 12 ? `${s.slice(0, 6)}...${s.slice(-4)}` : s; }
function userKey(v) { return String(v || '').replace(/^@/, '').toLowerCase().trim(); }
async function sendLocalTelegram(kind, username, text, dedupeKey) {
  const key = userKey(username);
  const connected = state.bots[key];
  if (!connected || !connected.chatId) return { ok: true, skipped: true, reason: key + ' has no tested Telegram bot', recipient: key, dedupe_key: dedupeKey };
  const bucket = kind === 'payment' ? state.sentPaymentAlerts : state.sentInvoiceAlerts;
  if (bucket[dedupeKey]) return { ok: true, skipped: true, reason: 'duplicate ' + kind + ' alert', recipient: key, dedupe_key: dedupeKey };
  await telegram(connected.token, 'sendMessage', { chat_id: connected.chatId, text, disable_web_page_preview: true });
  bucket[dedupeKey] = new Date().toISOString();
  saveState();
  return { ok: true, sent: true, recipient: key, bot_username: connected.bot && connected.bot.username, dedupe_key: dedupeKey };
}

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 200, { ok: true });
  const url = new URL(req.url, 'http://127.0.0.1:63856');

  if (req.method === 'GET') {
    if (url.pathname === '/telegram-bot-status') return json(res, 200, { ok: true, ...publicState(keyFrom({}, url)) });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end('<!doctype html><title>Arqis Telegram Test Backend</title><body style="font-family:system-ui;padding:32px;background:#0b0f19;color:#e8eefc"><h1>Arqis Telegram test backend is running</h1><p>Open the app here: <a style="color:#8fd" href="http://localhost:63854?localTelegram">http://localhost:63854?localTelegram</a></p></body>');
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  let body = {};
  try { body = await new Promise((resolve, reject) => { let s=''; req.on('data', c => s += c); req.on('end', () => resolve(s ? JSON.parse(s) : {})); req.on('error', reject); }); }
  catch { return json(res, 400, { error: 'Invalid JSON' }); }

  try {
    if (url.pathname === '/connect-telegram-bot') {
      const token = String(body.bot_token || body.token || '').trim();
      if (!validToken(token)) return json(res, 400, { error: 'Paste the BotFather token from Telegram' });
      const me = await telegram(token, 'getMe', {});
      const chatId = await resolveChatId(token, body.chat_id);
      const key = keyFrom(body, url);
      state.active = key;
      state.bots[key] = { token, bot: me, chatId, arqisUsername: key, connectedAt: new Date().toISOString(), testedAt: null };
      saveState();
      return json(res, 200, { ok: true, ...publicState(key), needs_start: !chatId });
    }
    if (url.pathname === '/send-test-alert') {
      const key = keyFrom(body, url);
      const connected = state.bots[key];
      if (!connected) return json(res, 409, { error: 'Connect bot first' });
      const chatId = await resolveChatId(connected.token, body.chat_id || connected.chatId);
      if (!chatId) return json(res, 409, { error: 'Open your bot on Telegram and send /start, then try again' });
      connected.chatId = chatId;
      const text = ['Arqis connected', '', `Telegram notifications are ready for @${key}.`, 'You will receive invoice and payment updates here.'].join('\n');
      await telegram(connected.token, 'sendMessage', { chat_id: chatId, text, disable_web_page_preview: true });
      connected.testedAt = new Date().toISOString();
      saveState();
      return json(res, 200, { ok: true, ...publicState(key) });
    }
    if (url.pathname === '/telegram-invoice-alert') {
      const invoice = body.invoice || body;
      if (!body.local_test_confirmed) return json(res, 200, { ok: true, skipped: true, reason: 'local test confirmation required' });
      const baseKey = String(invoice.id || invoice.invoice_no || '') || [invoice.from_username, invoice.to_username, invoice.amount, invoice.memo, invoice.created_at].map(x => String(x || '')).join('|');
      const seller = userKey(invoice.from_username || 'seller');
      const payer = userKey(invoice.to_username || 'payer');
      const amountLine = `${invoice.amount || '0.00'} ${invoice.token || 'USDC'} · ${invoice.invoice_no || 'INV'}`;
      const sellerText = [
        '🧾 Invoice sent',
        '',
        amountLine,
        `To: @${payer}`,
        `Memo: ${invoice.memo || '-'}`,
        '',
        `Expires: ${fmtDate(invoice.expires_at)}`,
        'Status: Pending',
        '',
        'View created invoices:',
        'http://localhost:63854?localTelegram#tab-create'
      ].join('\n');
      const payerText = [
        '📩 New invoice to pay',
        '',
        amountLine,
        `From: @${seller}`,
        `Memo: ${invoice.memo || '-'}`,
        '',
        `Due: ${fmtDate(invoice.expires_at)}`,
        'Status: Pending',
        '',
        'Pay invoice:',
        'http://localhost:63854?localTelegram#tab-pay'
      ].join('\n');
      const results = [];
      results.push(await sendLocalTelegram('invoice', seller, sellerText, baseKey + ':seller-created'));
      results.push(await sendLocalTelegram('invoice', payer, payerText, baseKey + ':payer-received'));
      return json(res, 200, { ok: true, results, sent: results.some(r => r.sent), skipped: results.every(r => r.skipped) });
    }
    if (url.pathname === '/telegram-payment-alert') {
      const invoice = body.invoice || body;
      if (!body.local_test_confirmed) return json(res, 200, { ok: true, skipped: true, reason: 'local test confirmation required' });
      const txHash = invoice.tx_hash || body.tx_hash || '0xlocal';
      const baseKey = String(invoice.id || invoice.invoice_no || '') + ':' + String(txHash);
      const seller = userKey(invoice.from_username || 'seller');
      const payer = userKey(invoice.to_username || 'payer');
      const shortTx = shortAddr(txHash);
      const amountLine = `${invoice.amount || '0.00'} ${invoice.token || 'USDC'} · ${invoice.invoice_no || 'INV'}`;
      const payerText = [
        '✅ Invoice paid',
        '',
        amountLine,
        `Paid to: @${seller}`,
        `Memo: ${invoice.memo || '-'}`,
        '',
        `Paid at: ${fmtDate(invoice.paid_at || new Date().toISOString())}`,
        `Tx: ${shortTx}`,
        '',
        'Receipt:',
        'http://localhost:63854?localTelegram#tab-pay'
      ].join('\n');
      const sellerText = [
        '💸 Payment received',
        '',
        amountLine,
        `Paid by: @${payer}`,
        `Memo: ${invoice.memo || '-'}`,
        '',
        `Paid at: ${fmtDate(invoice.paid_at || new Date().toISOString())}`,
        `Tx: ${shortTx}`,
        '',
        'Open Seller Console:',
        'http://localhost:63854?localTelegram#tab-console'
      ].join('\n');
      const results = [];
      results.push(await sendLocalTelegram('payment', payer, payerText, baseKey + ':payer-receipt'));
      results.push(await sendLocalTelegram('payment', seller, sellerText, baseKey + ':seller-paid'));
      return json(res, 200, { ok: true, results, sent: results.some(r => r.sent), skipped: results.every(r => r.skipped) });
    }
    if (url.pathname === '/disconnect-telegram-bot') {
      if (body.disconnect_all) {
        state = { active: null, bots: {} };
        saveState();
        return json(res, 200, { ok: true, connected: false, tested: false });
      }
      const key = keyFrom(body, url);
      delete state.bots[key];
      if (state.active === key) state.active = null;
      saveState();
      return json(res, 200, { ok: true, connected: false, tested: false });
    }
    return json(res, 404, { error: 'Not found' });
  } catch (e) { return json(res, 500, { error: e.message || 'Telegram test failed', details: e.details || null }); }
}).listen(63856, '127.0.0.1', () => console.log('Local Telegram test server http://127.0.0.1:63856'));
