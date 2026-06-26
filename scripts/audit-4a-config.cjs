const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

const checks = [];
function check(name, pass, detail = '') {
  checks.push({ name, pass, detail });
}

const gitignore = read('.gitignore');
const html = read('index.html');
const configExample = read(path.join('assets', 'arqis-config.example.js'));
const envExample = read('.env.example');
const proxy = read(path.join('api', 'circle-stablecoin-kits.js'));

check('assets/arqis-config.js is gitignored', /^assets\/arqis-config\.js$/m.test(gitignore));
check('.env is gitignored', /^\.env$/m.test(gitignore));

const configPos = html.indexOf('assets/arqis-config.js');
const swapPos = html.indexOf('assets/arqis-swap.js');
check('index loads arqis-config.js', configPos >= 0);
check('index loads arqis-swap.js', swapPos >= 0);
check('config loads before swap bundle', configPos >= 0 && swapPos >= 0 && configPos < swapPos);

check('config example defines CIRCLE_KIT_KEY', /CIRCLE_KIT_KEY\s*:/.test(configExample));
check('config example defines CIRCLE_PROXY_URL', /CIRCLE_PROXY_URL\s*:/.test(configExample));
check('config example warns against private secrets', /Do not put PRIVATE_KEY, CIRCLE_API_KEY, or CIRCLE_ENTITY_SECRET here\./.test(configExample));

check('env example distinguishes frontend config', /Phase 4A public-wallet swap frontend config lives in assets\/arqis-config\.js\./.test(envExample));
check('env example warns not to copy private values to browser config', /Do not put PRIVATE_KEY, DEPLOYER_PRIVATE_KEY, CIRCLE_API_KEY, or CIRCLE_ENTITY_SECRET in browser config\./.test(envExample));
check('env example has placeholder deployer key only', /DEPLOYER_PRIVATE_KEY=replace_with_testnet_deployer_private_key_do_not_commit_real_value/.test(envExample));
check('env example has placeholder Circle API key only', /CIRCLE_API_KEY=replace_with_circle_api_key_do_not_commit_real_value/.test(envExample));

check('Circle proxy restricts stablecoinKits path', /path\.startsWith\('\/v1\/stablecoinKits\/'\)/.test(proxy));
check('Circle proxy origin fixed to api.circle.com', /const CIRCLE_ORIGIN = 'https:\/\/api\.circle\.com';/.test(proxy));

const frontendFiles = ['index.html', path.join('assets', 'arqis-config.example.js'), path.join('src', 'arqis-swap-browser.js'), path.join('api', 'circle-stablecoin-kits.js')];
const suspicious = [];
for (const file of frontendFiles) {
  const text = read(file);
  const patterns = [
    [/0x[a-fA-F0-9]{64}/g, '64-hex private-key-like value'],
    [/sk_(live|test)_[A-Za-z0-9_-]+/g, 'sk_* secret-like value'],
    [/CIRCLE_API_KEY\s*[:=]\s*['\"][^'\"]{12,}/g, 'hardcoded Circle API key assignment'],
    [/CIRCLE_ENTITY_SECRET\s*[:=]\s*['\"][^'\"]{12,}/g, 'hardcoded Circle entity secret assignment'],
  ];
  for (const [re, label] of patterns) {
    const matches = text.match(re) || [];
    for (const match of matches) {
      // ERC-20 Transfer event topic, not a secret/private key.
      if (match.toLowerCase() === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') continue;
      suspicious.push(`${file}: ${label}: ${match.slice(0, 18)}...`);
    }
  }
}
check('no obvious frontend/proxy secret literals', suspicious.length === 0, suspicious.join('\n'));

let ok = true;
for (const item of checks) {
  console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.detail && !item.pass ? `\n${item.detail}` : ''}`);
  if (!item.pass) ok = false;
}
process.exit(ok ? 0 : 1);
