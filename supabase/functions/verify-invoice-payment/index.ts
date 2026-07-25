// Supabase Edge Function: verify-invoice-payment
// Browser clients submit invoice_id + tx_hash; this function verifies Arc Testnet USDC transfer
// before marking the invoice paid with the Supabase service role.

const ARC_RPC_URL = Deno.env.get('ARC_RPC_URL') || 'https://rpc.testnet.arc.network';
const ARC_CHAIN_ID = (Deno.env.get('ARC_CHAIN_ID') || '0x4cef52').toLowerCase(); // 5042002
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const USDC_TOKEN = (Deno.env.get('USDC_TOKEN') || '0x3600000000000000000000000000000000000000').toLowerCase();
const USDC_DECIMALS = Number(Deno.env.get('USDC_DECIMALS') || '6');
const NATIVE_USDC_DECIMALS = Number(Deno.env.get('NATIVE_USDC_DECIMALS') || '18');
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'Arqis <alerts@arqis.site>';

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type'
    }
  });
}
function isHash(v: unknown) { return typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v); }
function isUuid(v: unknown) { return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v); }
function isAddress(v: unknown) { return typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v); }
function padAddress(addr: string) { return addr.toLowerCase().replace(/^0x/, '').padStart(64, '0'); }
function amountToUnits(value: unknown, decimals = USDC_DECIMALS) {
  const raw = String(value ?? '0').trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error('Invalid invoice amount');
  const [whole, frac = ''] = raw.split('.');
  return BigInt((whole || '0') + frac.slice(0, decimals).padEnd(decimals, '0'));
}
async function rpc(method: string, params: unknown[]) {
  const r = await fetch(ARC_RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || 'RPC error');
  return j.result;
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
async function patchInvoiceVerification(invoiceId: string, patch: Record<string, unknown>) {
  const path = `arcflow_invoices?id=eq.${encodeURIComponent(invoiceId)}&status=in.(unpaid,pending)&select=id`;
  try {
    await supabase(path, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify(patch) });
  } catch (error) {
    if (!Object.prototype.hasOwnProperty.call(patch, 'failure_reason')) throw error;
    const { failure_reason: _unused, ...fallbackPatch } = patch;
    await supabase(path, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify(fallbackPatch) });
  }
}
async function markVerificationPending(invoiceId: string, txHash: string) {
  await patchInvoiceVerification(invoiceId, {
    status: 'pending',
    tx_hash: txHash,
    payment_method: 'standard_arc_usdc',
    payment_status: 'verifying',
    receipt_version: '1.1',
    settlement_chain: 'arc-testnet',
    source_chains: ['arc-testnet'],
    verification_checks: { submitted: true, backend_verifying: true, failure_reason: null },
    failure_reason: null
  });
}
async function markVerificationFailed(invoiceId: string, txHash: string, reason: string) {
  await patchInvoiceVerification(invoiceId, {
    status: 'failed',
    tx_hash: txHash,
    payment_method: 'standard_arc_usdc',
    payment_status: 'failed',
    receipt_version: '1.1',
    settlement_chain: 'arc-testnet',
    source_chains: ['arc-testnet'],
    verification_checks: { submitted: true, backend_verified: false, failure_reason: reason },
    failure_reason: reason
  });
}
async function sendTelegramPaymentAlert(invoiceId: string, txHash: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/telegram-payment-alert`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ invoice_id: invoiceId, tx_hash: txHash })
    });
    if (!res.ok) console.warn('Telegram payment alert failed', await res.text());
  } catch (error) {
    console.warn('Telegram payment alert unavailable', error);
  }
}

function cleanEmail(v: unknown) {
  const s = String(v || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254 ? s : '';
}
function escapeHtml(v: unknown) {
  return String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
}
function detailRow(label: string, value: unknown) {
  return `<tr><td style="padding:10px 0;font-size:13px;line-height:1.5;color:#667085;border-bottom:1px solid #eef2f7">${escapeHtml(label)}</td><td align="right" style="padding:10px 0;font-size:13px;line-height:1.5;color:#344054;font-weight:700;border-bottom:1px solid #eef2f7">${escapeHtml(value || '-')}</td></tr>`;
}
function displayNetwork(value: unknown) {
  return String(value || 'arc-testnet').toLowerCase() === 'arc-testnet' ? 'Arc Testnet' : String(value || 'Arc Testnet');
}
function formatPaidAt(value: unknown) {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return String(value || '-');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} - ${hour}:${minute} UTC`;
}
function shortenTxHash(value: unknown) {
  const hash = String(value || '');
  return hash.length > 11 ? `${hash.slice(0, 6)}...${hash.slice(-5)}` : hash;
}
function invoiceDeepLink(invoice: Record<string, unknown>) {
  return `https://www.arqis.site/app/pay-invoice?invoice_id=${encodeURIComponent(String(invoice.id || ''))}`;
}
function sellerInvoiceDeepLink(invoice: Record<string, unknown>) {
  return `https://www.arqis.site/app/seller-console?invoice_id=${encodeURIComponent(String(invoice.id || ''))}`;
}
function emailLayout(title: string, intro: string, amountLabel: string, amountValue: string, rows: string, invoiceLink: string, ctaLabel = 'Open invoice') {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f7fb;font-family:Inter,Arial,sans-serif;color:#111827">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent">${escapeHtml(intro)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:28px 12px">
      <tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e8edf5;box-shadow:0 12px 32px rgba(15,23,42,.08)">
        <tr><td style="padding:0;background:#ffffff"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#071827;border-radius:18px 18px 0 0;overflow:hidden"><tr><td valign="middle" style="padding:28px 0 28px 30px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td valign="middle" style="padding-right:12px"><img src="https://arqis.site/assets/arqis-logo.png" width="44" alt="Arqis logo" style="display:block;border:0;width:44px;height:auto;border-radius:12px"></td><td valign="middle"><div style="font-size:22px;line-height:1;font-weight:800;letter-spacing:.08em;color:#ffffff">ARQIS</div><div style="margin-top:7px;font-size:13px;line-height:1.4;color:#c7d6e8">Stablecoin invoice payments on Arc Testnet</div></td></tr></table></td><td align="right" valign="middle" style="padding:22px 30px 22px 8px;width:86px">&nbsp;</td></tr></table><div style="padding:24px 30px 18px 30px"><div style="font-size:28px;line-height:1.18;font-weight:800;letter-spacing:-.03em;color:#101828">${escapeHtml(title)}</div><div style="margin-top:10px;font-size:15px;line-height:1.6;color:#667085">${escapeHtml(intro)}</div></div></td></tr>
        <tr><td style="padding:26px 30px 10px 30px"><div style="font-size:13px;font-weight:700;color:#344054;margin-bottom:10px">${escapeHtml(amountLabel)}</div><div style="background:#f8fafc;border:1px solid #e5eaf2;border-radius:14px;padding:22px 18px;text-align:center;font-size:30px;line-height:1.15;font-weight:800;letter-spacing:-.03em;color:#0f172a">${escapeHtml(amountValue)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-collapse:collapse">${rows}</table><div style="margin-top:18px;font-size:14px;line-height:1.65;color:#667085">This confirmation was sent after Arqis backend verification marked the invoice as <strong style="color:#344054">Paid</strong>.</div><div style="margin-top:18px"><a href="${escapeHtml(invoiceLink)}" style="display:block;width:100%;box-sizing:border-box;background:#071827;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:700;text-align:center">${escapeHtml(ctaLabel)}</a></div><div style="margin-top:18px;background:#f8fafc;border:1px solid #e5eaf2;border-radius:12px;padding:14px 16px;font-size:14px;line-height:1.6;color:#475467"><strong style="color:#344054">Need help?</strong><br>Contact the Arqis team at <a href="mailto:support@arqis.site" style="color:#2563eb;text-decoration:none;font-weight:700">support@arqis.site</a>.</div></td></tr>
        <tr><td style="padding:16px 30px 28px 30px"><div style="border-top:1px solid #eef2f7;padding-top:18px;font-size:13px;line-height:1.6;color:#98a2b3">Arqis payment emails are notifications only. Always verify payment details in your wallet or Arqis app before taking external action.</div></td></tr>
      </table><div style="max-width:560px;text-align:left;padding:18px 8px 0 8px;font-size:12px;line-height:1.6;color:#98a2b3">Thanks for using Arqis.<br>Arqis Support Team<br><br>Arqis never asks for your seed phrase or private key.</div></td></tr>
    </table>
  </body>
</html>`;
}
function paymentEmailHtml(kind: 'seller' | 'payer', invoice: Record<string, unknown>) {
  const amount = `${invoice.amount} ${invoice.token || 'USDC'}`;
  const invoiceId = invoice.invoice_no || invoice.id;
  const paidAt = invoice.paid_at || invoice.verified_at || new Date().toISOString();
  const isSeller = kind === 'seller';
  const ctaUrl = isSeller ? sellerInvoiceDeepLink(invoice) : invoiceDeepLink(invoice);
  const ctaLabel = isSeller ? 'View payment' : 'Open invoice';
  const rows = [
    detailRow(isSeller ? 'Paid by' : 'Paid to', `@${isSeller ? invoice.to_username : invoice.from_username}`),
    detailRow('Invoice ID', invoiceId),
    detailRow('Memo', invoice.memo),
    detailRow('Network', displayNetwork(invoice.settlement_chain)),
    detailRow('Paid At', formatPaidAt(paidAt)),
    detailRow('Transaction Hash', shortenTxHash(invoice.tx_hash)),
    detailRow('Status', 'Paid')
  ].join('');
  return emailLayout(
    isSeller ? 'Your invoice has been paid' : 'Payment successful',
    isSeller ? `@${invoice.to_username} paid your Arqis invoice.` : `Your payment to @${invoice.from_username} was successful.`,
    isSeller ? 'Amount received' : 'Amount paid',
    amount,
    rows,
    ctaUrl,
    ctaLabel
  );
}
async function getUserByUsername(username: unknown) {
  const rows = await supabase(`arcflow_users?username=eq.${encodeURIComponent(String(username || ''))}&select=username,email,email_verified_at&limit=1`);
  return rows[0] || null;
}
async function sendPaymentEmail(to: string, subject: string, text: string, html: string) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, text, html })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(JSON.stringify(data));
  return data;
}
async function sendPaymentConfirmationEmails(invoice: Record<string, unknown>) {
  const [seller, payer] = await Promise.all([getUserByUsername(invoice.from_username), getUserByUsername(invoice.to_username)]);
  const amount = `${invoice.amount} ${invoice.token || 'USDC'}`;
  const invoiceId = invoice.invoice_no || invoice.id;
  const paidAt = invoice.paid_at || invoice.verified_at || new Date().toISOString();
  const baseDetails = `Invoice ID: ${invoiceId}\nMemo: ${invoice.memo || '-'}\nNetwork: ${invoice.settlement_chain || 'arc-testnet'}\nPaid At: ${paidAt}\nTransaction Hash: ${invoice.tx_hash}\nStatus: Paid`;
  const results: Record<string, string> = { seller: 'skipped', payer: 'skipped' };
  if (cleanEmail(seller?.email) && seller?.email_verified_at) {
    await sendPaymentEmail(cleanEmail(seller.email), 'Your invoice has been paid', `Amount received: ${amount}\nPaid by: @${invoice.to_username}\n${baseDetails}`, paymentEmailHtml('seller', invoice));
    results.seller = 'sent';
  }
  if (cleanEmail(payer?.email) && payer?.email_verified_at) {
    await sendPaymentEmail(cleanEmail(payer.email), 'Payment successful', `Amount paid: ${amount}\nPaid to: @${invoice.from_username}\n${baseDetails}`, paymentEmailHtml('payer', invoice));
    results.payer = 'sent';
  }
  return results;
}
Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return json({ ok: true });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'Function is not configured' }, 500);
    if (!isAddress(USDC_TOKEN)) return json({ error: 'USDC_TOKEN is not configured' }, 500);

    const chainId = String(await rpc('eth_chainId', [])).toLowerCase();
    if (chainId !== ARC_CHAIN_ID) return json({ error: 'RPC is not Arc Testnet', chainId }, 500);

    const { invoice_id, tx_hash } = await req.json().catch(() => ({}));
    if (!isUuid(invoice_id) || !isHash(tx_hash)) return json({ error: 'valid invoice_id and tx_hash are required' }, 400);

    const existing = await supabase(`arcflow_invoices?tx_hash=eq.${encodeURIComponent(tx_hash)}&select=id`);
    if (existing.length && existing[0].id !== invoice_id) return json({ status: 'failed', invoice_id, tx_hash, failure_reason: 'duplicate_tx_hash', error: 'Transaction hash already used' }, 409);

    const rows = await supabase(`arcflow_invoices?id=eq.${encodeURIComponent(invoice_id)}&select=*`);
    const invoice = rows[0];
    if (!invoice) return json({ error: 'Invoice not found' }, 404);
    if (invoice.status === 'paid') {
      if (String(invoice.tx_hash || '').toLowerCase() === String(tx_hash).toLowerCase()) await sendTelegramPaymentAlert(invoice_id, tx_hash);
      return json({ status: 'paid', invoice_id, tx_hash: invoice.tx_hash || tx_hash });
    }
    if (!['unpaid', 'pending'].includes(invoice.status)) return json({ error: `Invoice is ${invoice.status}` }, 409);
    if (!isAddress(invoice.from_wallet)) return json({ error: 'Invoice recipient wallet is invalid' }, 409);
    if (invoice.token && String(invoice.token).toUpperCase() !== 'USDC') return json({ error: 'Invoice token is not USDC' }, 409);
    if (invoice.expires_at && new Date(invoice.expires_at).getTime() < Date.now()) return json({ status: 'failed', invoice_id, tx_hash, failure_reason: 'invoice_expired', error: 'Invoice expired' }, 409);

    const receipt = await rpc('eth_getTransactionReceipt', [tx_hash]);
    if (!receipt) {
      await markVerificationPending(invoice_id, tx_hash);
      return json({ status: 'pending', payment_status: 'verifying', invoice_id, tx_hash, failure_reason: null }, 202);
    }
    if (String(receipt.status).toLowerCase() !== '0x1') {
      await markVerificationFailed(invoice_id, tx_hash, 'transaction_failed');
      return json({ status: 'failed', invoice_id, tx_hash, failure_reason: 'transaction_failed', error: 'Transaction failed' }, 409);
    }

    const tx = await rpc('eth_getTransactionByHash', [tx_hash]);
    const nativeExpectedAmount = amountToUnits(invoice.amount, NATIVE_USDC_DECIMALS);
    const nativeMatched = tx
      && String(tx.to || '').toLowerCase() === String(invoice.from_wallet).toLowerCase()
      && (() => { try { return BigInt(tx.value || '0x0') >= nativeExpectedAmount; } catch (_) { return false; } })();

    const expectedRecipientTopic = '0x' + padAddress(invoice.from_wallet);
    const tokenExpectedAmount = amountToUnits(invoice.amount, USDC_DECIMALS);
    const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
    const tokenMatched = logs.some((log) => {
      const topics = log.topics || [];
      if (String(log.address || '').toLowerCase() !== USDC_TOKEN) return false;
      if (String(topics[0] || '').toLowerCase() !== TRANSFER_TOPIC) return false;
      if (String(topics[2] || '').toLowerCase() !== expectedRecipientTopic) return false;
      try { return BigInt(log.data || '0x0') >= tokenExpectedAmount; } catch (_) { return false; }
    });
    if (!nativeMatched && !tokenMatched) {
      await markVerificationFailed(invoice_id, tx_hash, 'recipient_or_amount_mismatch');
      return json({ status: 'failed', invoice_id, tx_hash, failure_reason: 'recipient_or_amount_mismatch', error: 'No matching native or token USDC transfer for invoice' }, 409);
    }

    const verifiedAt = new Date().toISOString();
    const patch = {
      status: 'paid',
      tx_hash,
      paid_at: verifiedAt,
      payment_method: 'standard_arc_usdc',
      payment_status: 'completed',
      receipt_version: '1.1',
      verified_at: verifiedAt,
      settlement_chain: 'arc-testnet',
      source_chains: ['arc-testnet'],
      verification_checks: {
        chain: true,
        recipient: true,
        amount: true,
        token: true,
        tx_success: true,
        backend_verified: true
      },
      failure_reason: null
    };
    const updated = await supabase(`arcflow_invoices?id=eq.${encodeURIComponent(invoice_id)}&status=in.(unpaid,pending)&select=id`, {
      method: 'PATCH',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify(patch)
    });
    let email_status: Record<string, string> = { seller: 'skipped', payer: 'skipped' };
    if (Array.isArray(updated) && updated.length) {
      const paidInvoice = { ...invoice, ...patch };
      await sendTelegramPaymentAlert(invoice_id, tx_hash);
      try {
        email_status = await sendPaymentConfirmationEmails(paidInvoice);
      } catch (error) {
        console.error('payment confirmation email failed', error);
        email_status = { seller: 'failed', payer: 'failed' };
      }
    }
    return json({ status: 'paid', invoice_id, tx_hash, email_status });
  } catch (error) {
    console.error(error);
    return json({ error: 'Verification failed' }, 500);
  }
});
