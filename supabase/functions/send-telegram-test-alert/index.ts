const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const TOKEN_KEY = Deno.env.get('TELEGRAM_TOKEN_ENCRYPTION_KEY') || '';
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' } }); }
function isWallet(v: unknown) { return typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v); }
function bytesFromB64(v: string) { return Uint8Array.from(atob(v), c => c.charCodeAt(0)); }
async function shaKey(secret: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)); return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt']); }
async function decryptToken(cipherText: string) { if (TOKEN_KEY.length < 24) throw new Error('TELEGRAM_TOKEN_ENCRYPTION_KEY is not configured'); const [ivB64, dataB64] = String(cipherText || '').split(':'); if (!ivB64 || !dataB64) throw new Error('Stored bot token is invalid'); const key = await shaKey(TOKEN_KEY); const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytesFromB64(ivB64) }, key, bytesFromB64(dataB64)); return new TextDecoder().decode(plain); }
async function telegram(token: string, method: string, body: Record<string, unknown> = {}) { const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const data = await res.json().catch(() => ({})); if (!res.ok || data.ok === false) throw new Error(data.description || `Telegram ${method} failed`); return data.result; }
async function supabase(path: string, init: RequestInit = {}) { const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'content-type': 'application/json', ...(init.headers || {}) } }); if (!r.ok) throw new Error(await r.text()); return r.status === 204 ? null : await r.json(); }
async function resolveChatId(token: string, stored?: string) { if (stored) return stored; const updates = await telegram(token, 'getUpdates', { limit: 30, timeout: 0, allowed_updates: ['message'] }); const start = [...updates].reverse().find((u: any) => u.message?.chat?.id && String(u.message?.text || '').startsWith('/start')); return start ? String(start.message.chat.id) : ''; }
function publicBot(row: Record<string, unknown>) { return { connected: true, tested: Boolean(row.tested_at), bot: { id: row.bot_id, username: row.bot_username, first_name: row.bot_display_name }, connected_at: row.connected_at || null, tested_at: row.tested_at || null }; }
Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return json({ ok: true });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'Function is not configured' }, 500);
    const { wallet_address } = await req.json().catch(() => ({}));
    const wallet = String(wallet_address || '').trim();
    if (!isWallet(wallet)) return json({ error: 'wallet_address is required' }, 400);
    const rows = await supabase(`seller_telegram_bots?wallet_address=eq.${encodeURIComponent(wallet)}&disconnected_at=is.null&select=*&limit=1`);
    const row = rows[0];
    if (!row) return json({ error: 'Connect bot first' }, 409);
    const token = await decryptToken(row.bot_token_cipher);
    const chatId = await resolveChatId(token, row.chat_id || undefined);
    if (!chatId) return json({ error: 'Open your bot on Telegram and send /start, then try again' }, 409);
    const text = ['Arqis connected', '', `Telegram notifications are ready for @${row.arqis_username}.`, 'You will receive invoice and payment updates here.'].join('\n');
    await telegram(token, 'sendMessage', { chat_id: chatId, text, disable_web_page_preview: true });
    const patch = { chat_id: chatId, tested_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const updated = await supabase(`seller_telegram_bots?wallet_address=eq.${encodeURIComponent(wallet)}&select=*`, { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify(patch) });
    await supabase('telegram_alert_deliveries', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ seller_username: row.arqis_username, alert_type: 'test', telegram_bot_username: row.bot_username, telegram_chat_id: chatId, status: 'sent', sent_at: new Date().toISOString() }) });
    return json({ ok: true, ...publicBot(updated[0]) });
  } catch (error) {
    console.error(error);
    return json({ error: 'Test alert failed' }, 500);
  }
});
