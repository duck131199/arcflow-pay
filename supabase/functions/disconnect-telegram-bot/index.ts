const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' } }); }
function isWallet(v: unknown) { return typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v); }
async function supabase(path: string, init: RequestInit = {}) { const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'content-type': 'application/json', ...(init.headers || {}) } }); if (!r.ok) throw new Error(await r.text()); return r.status === 204 ? null : await r.json(); }
Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return json({ ok: true });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'Function is not configured' }, 500);
    const { wallet_address } = await req.json().catch(() => ({}));
    const wallet = String(wallet_address || '').trim();
    if (!isWallet(wallet)) return json({ error: 'wallet_address is required' }, 400);
    await supabase(`seller_telegram_bots?wallet_address=eq.${encodeURIComponent(wallet)}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ disconnected_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
    return json({ ok: true, connected: false, tested: false });
  } catch (error) {
    console.error(error);
    return json({ error: 'Disconnect failed' }, 500);
  }
});
