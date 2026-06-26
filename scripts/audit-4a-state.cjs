const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const checks = [
  ['reset on leaving pay', /if\(leavingPay\)\{state\.currentInvoice=null;resetSwapState\(\);closeSwapPreview\(\);renderPayInvoice\(\);renderAssets\(\)\}/],
  ['reset on invoice select', /if\(inv\)\{resetSwapState\(\);closeSwapPreview\(\);const st=effectiveInvoiceStatus\(inv\)/],
  ['quote sequence guard', /const seq=\+\+state\.swapAutoQuoteSeq[\s\S]*if\(seq!==state\.swapAutoQuoteSeq\)return/],
  ['confirm locks state', /state\.swapBusy=true;state\.swapConfirming=true;renderSwapPreview\(true\);toast\('Open your wallet to confirm swap\.\.\.'\)/],
  ['confirm unlock finally', /finally\{state\.swapBusy=false;state\.swapConfirming=false;renderSwapPreview\(true\)\}/],
  ['usable estimate disables stale confirm', /const usableEstimate=estimate&&!quoteBusy\?estimate:null[\s\S]*id="executeSwapBtn"[\s\S]*\(!usableEstimate\|\|state\.swapBusy\|\|state\.swapConfirming\|\|lacksUsdcFee\)/],
  ['paid preview copy', /This invoice is already paid\. Open the receipt or choose another payable invoice\./],
  ['reset clears timers and sequence', /function resetSwapState\(\)\{[\s\S]*clearTimeout\(state\.swapAutoQuoteTimer\)[\s\S]*clearInterval\(state\.swapLiveQuoteTimer\)[\s\S]*state\.swapAutoQuoteSeq\+\+/],
];
let ok = true;
for (const [name, re] of checks) {
  const pass = re.test(html);
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
  if (!pass) ok = false;
}
process.exit(ok ? 0 : 1);
