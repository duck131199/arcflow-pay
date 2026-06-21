// Supabase Edge Function: connect-telegram-bot
// Validates a seller-owned BotFather token and stores it server-side for Arqis notifications.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const TOKEN_KEY = Deno.env.get('TELEGRAM_TOKEN_ENCRYPTION_KEY') || '';

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
      'access-control-allow-methods': 'POST, OPTIONS'
    }
  });
}
function isWallet(v: unknown) { return typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v); }
function isName(v: unknown) { return typeof v === 'string' && /^[a-z0-9_]{3,24}$/.test(v); }
function isToken(v: unknown) { return typeof v === 'string' && /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(v.trim()); }
class PublicError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
function publicBot(row: Record<string, unknown>) {
  return {
    connected: true,
    tested: Boolean(row.tested_at),
    bot: { id: row.bot_id, username: row.bot_username, first_name: row.bot_display_name },
    connected_at: row.connected_at || null,
    tested_at: row.tested_at || null
  };
}
async function shaKey(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt']);
}
function b64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)); }
async function encryptToken(token: string) {
  if (TOKEN_KEY.length < 24) throw new Error('TELEGRAM_TOKEN_ENCRYPTION_KEY is not configured');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await shaKey(TOKEN_KEY);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token)));
  return `${b64(iv)}:${b64(cipher)}`;
}
async function telegram(token: string, method: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const description = String(data.description || '').toLowerCase();
    if (res.status === 401 || description.includes('unauthorized') || description.includes('not found')) {
      throw new PublicError('BotFather token is invalid or revoked', 400);
    }
    throw new PublicError('Telegram rejected the bot token', 400);
  }
  return data.result;
}
async function supabase(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      ...(init.headers || {})
    }
  });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : await r.json();
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return json({ ok: true });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'Function is not configured' }, 500);

    const { wallet_address, arqis_username, bot_token } = await req.json().catch(() => ({}));
    const wallet = String(wallet_address || '').trim();
    const username = String(arqis_username || '').trim().replace(/^@/, '').toLowerCase();
    const token = String(bot_token || '').trim();
    if (!isWallet(wallet) || !isName(username) || !isToken(token)) {
      return json({ error: 'wallet_address, arqis_username, and valid BotFather token are required' }, 400);
    }

    const users = await supabase(`arcflow_users?wallet_address=eq.${encodeURIComponent(wallet)}&username=eq.${encodeURIComponent(username)}&select=username,wallet_address`);
    if (!users.length) return json({ error: 'Wallet does not match this Arqis name' }, 403);

    const me = await telegram(token, 'getMe');
    if (!me?.is_bot || !me?.username) return json({ error: 'Token does not belong to a Telegram bot' }, 400);
    const expected = `${username.replace(/(^|_)([a-z])/g, (_: string, p: string, c: string) => p + c.toUpperCase())}_bot`.toLowerCase();
    const actual = String(me.username).toLowerCase();
    const username_matches_recommendation = actual === expected;

    const cipher = await encryptToken(token);
    const payload = {
      wallet_address: wallet,
      arqis_username: username,
      bot_id: String(me.id),
      bot_username: String(me.username),
      bot_display_name: String(me.first_name || me.username),
      bot_token_cipher: cipher,
      disconnected_at: null,
      updated_at: new Date().toISOString()
    };
    const rows = await supabase('seller_telegram_bots?on_conflict=wallet_address&select=*', {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(payload)
    });
    return json({ ok: true, ...publicBot(rows[0]), username_matches_recommendation, recommended_username: expected });
  } catch (error) {
    console.error(error);
    if (error instanceof PublicError) return json({ error: error.message }, error.status);
    return json({ error: 'Telegram bot connection failed' }, 500);
  }
});
