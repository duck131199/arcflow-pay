import { AppKit } from '@circle-fin/app-kit';
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2';

const kit = new AppKit();
let circleProxyInstalled = false;

function kitKey() {
  return window.ARQIS_CONFIG && window.ARQIS_CONFIG.CIRCLE_KIT_KEY;
}

function providerFrom(inputProvider) {
  const provider = inputProvider || window.ethereum;
  if (!provider || typeof provider.request !== 'function') {
    throw new Error('No compatible browser wallet provider found. Connect MetaMask, Rabby, OKX Wallet, or another EIP-1193 wallet.');
  }
  return provider;
}

async function createArcAdapter(inputProvider) {
  return createViemAdapterFromProvider({ provider: providerFrom(inputProvider) });
}

function assertConfig() {
  if (!kitKey()) {
    throw new Error('Circle Kit Key is not configured. Set window.ARQIS_CONFIG.CIRCLE_KIT_KEY in assets/arqis-config.js.');
  }
}

function circleProxyUrl() {
  if (window.ARQIS_CONFIG && window.ARQIS_CONFIG.CIRCLE_PROXY_URL === false) return '';
  return (window.ARQIS_CONFIG && window.ARQIS_CONFIG.CIRCLE_PROXY_URL) || '/api/circle-stablecoin-kits';
}

function installCircleProxyFetch() {
  const proxy = circleProxyUrl();
  if (!proxy || circleProxyInstalled || typeof window.fetch !== 'function') return;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input && input.url;
    if (rawUrl && rawUrl.startsWith('https://api.circle.com/v1/stablecoinKits/')) {
      const target = new URL(rawUrl);
      const proxyTarget = new URL(proxy, window.location.origin);
      proxyTarget.searchParams.set('path', target.pathname);
      for (const [key, value] of target.searchParams.entries()) proxyTarget.searchParams.append(key, value);
      if (typeof input === 'string') return originalFetch(proxyTarget.toString(), init);
      return originalFetch(new Request(proxyTarget.toString(), input), init);
    }
    return originalFetch(input, init);
  };
  circleProxyInstalled = true;
}

function normalizeSwapResult(result) {
  return {
    tokenIn: result?.tokenIn,
    tokenOut: result?.tokenOut,
    amountIn: result?.amountIn,
    amountOut: result?.amountOut || null,
    chainIn: result?.chainIn,
    chainOut: result?.chainOut,
    fromAddress: result?.fromAddress,
    toAddress: result?.toAddress,
    txHash: result?.txHash || '',
    explorerUrl: result?.explorerUrl || (result?.txHash ? `https://testnet.arcscan.app/tx/${result.txHash}` : ''),
    fees: result?.fees || [],
    progress: result?.progress || null,
    config: result?.config || null,
  };
}

function normalizeEstimate(estimate) {
  return {
    tokenIn: estimate?.tokenIn,
    tokenOut: estimate?.tokenOut,
    amountIn: estimate?.amountIn,
    chainIn: estimate?.chainIn,
    chainOut: estimate?.chainOut,
    fromAddress: estimate?.fromAddress,
    toAddress: estimate?.toAddress,
    estimatedOutput: estimate?.estimatedOutput,
    stopLimit: estimate?.stopLimit,
    fees: estimate?.fees || [],
  };
}

async function estimateSwapToUsdc({ provider, tokenIn, amountIn, slippageBps = 300 }) {
  assertConfig();
  installCircleProxyFetch();
  if (!tokenIn || !amountIn) throw new Error('tokenIn and amountIn are required');
  const adapter = await createArcAdapter(provider);
  const estimate = await kit.estimateSwap({
    from: { adapter, chain: 'Arc_Testnet' },
    tokenIn,
    tokenOut: 'USDC',
    amountIn: String(amountIn),
    config: { kitKey: kitKey(), slippageBps },
  });
  return normalizeEstimate(estimate);
}

async function swapToUsdc({ provider, tokenIn, amountIn, slippageBps = 300 }) {
  assertConfig();
  installCircleProxyFetch();
  if (!tokenIn || !amountIn) throw new Error('tokenIn and amountIn are required');
  const adapter = await createArcAdapter(provider);
  const result = await kit.swap({
    from: { adapter, chain: 'Arc_Testnet' },
    tokenIn,
    tokenOut: 'USDC',
    amountIn: String(amountIn),
    config: { kitKey: kitKey(), slippageBps },
  });
  return normalizeSwapResult(result);
}

async function getSwapStatus({ txHash, chainIn = 'Arc_Testnet', chainOut = 'Arc_Testnet' }) {
  assertConfig();
  installCircleProxyFetch();
  const status = await kit.getSwapStatus({ txHash, chainIn, chainOut, kitKey: kitKey() });
  return status;
}

window.ArqisSwap = {
  estimateSwapToUsdc,
  swapToUsdc,
  getSwapStatus,
};
