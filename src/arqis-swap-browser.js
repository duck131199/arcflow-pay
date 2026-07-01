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

async function createUnifiedAdapter(inputProvider) {
  return createViemAdapterFromProvider({
    provider: providerFrom(inputProvider),
    capabilities: { addressContext: 'user-controlled' },
  });
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

function normalizeUnifiedEstimate(estimate) {
  return {
    fees: estimate?.fees || [],
  };
}

function normalizeUnifiedSpendResult(result) {
  return {
    allocations: result?.allocations || [],
    recipientAddress: result?.recipientAddress || '',
    destinationChain: result?.destinationChain || 'Arc_Testnet',
    txHash: result?.txHash || '',
    explorerUrl: result?.explorerUrl || (result?.txHash ? `https://testnet.arcscan.app/tx/${result.txHash}` : ''),
    fees: result?.fees || [],
    transferId: result?.transferId || '',
    expirationBlock: result?.expirationBlock || '',
    steps: result?.steps || [],
  };
}

function normalizeUnifiedDepositResult(result) {
  return {
    amount: result?.amount || '',
    token: result?.token || 'USDC',
    depositedTo: result?.depositedTo || '',
    depositedBy: result?.depositedBy || '',
    chain: result?.chain || '',
    txHash: result?.txHash || '',
    explorerUrl: result?.explorerUrl || (result?.txHash ? `https://testnet.arcscan.app/tx/${result.txHash}` : ''),
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

async function estimateUnifiedSpend({ provider, amount, allocations, recipientAddress }) {
  assertConfig();
  installCircleProxyFetch();
  if (!amount) throw new Error('amount is required');
  if (!recipientAddress) throw new Error('recipientAddress is required');
  if (!allocations || !allocations.length) throw new Error('allocations are required');
  const adapter = await createUnifiedAdapter(provider);
  const estimate = await kit.unifiedBalance.estimateSpend({
    from: { adapter, allocations },
    to: { chain: 'Arc_Testnet', recipientAddress, useForwarder: true },
    token: 'USDC',
    amount: String(amount),
  });
  return normalizeUnifiedEstimate(estimate);
}

async function spendUnifiedBalance({ provider, amount, allocations, recipientAddress }) {
  assertConfig();
  installCircleProxyFetch();
  if (!amount) throw new Error('amount is required');
  if (!recipientAddress) throw new Error('recipientAddress is required');
  if (!allocations || !allocations.length) throw new Error('allocations are required');
  const adapter = await createUnifiedAdapter(provider);
  const result = await kit.unifiedBalance.spend({
    from: { adapter, allocations },
    to: { chain: 'Arc_Testnet', recipientAddress, useForwarder: true },
    token: 'USDC',
    amount: String(amount),
  });
  return normalizeUnifiedSpendResult(result);
}

async function depositUnifiedBalance({ provider, chain, amount, allowanceStrategy = 'authorize' }) {
  assertConfig();
  installCircleProxyFetch();
  if (!chain) throw new Error('chain is required');
  if (!amount) throw new Error('amount is required');
  const adapter = await createUnifiedAdapter(provider);
  const result = await kit.unifiedBalance.deposit({
    from: { adapter, chain },
    amount: String(amount),
    token: 'USDC',
    allowanceStrategy,
  });
  return normalizeUnifiedDepositResult(result);
}

async function getUnifiedBalances({ provider, chains = ['Ethereum_Sepolia', 'Base_Sepolia', 'Avalanche_Fuji'] } = {}) {
  assertConfig();
  installCircleProxyFetch();
  const adapter = await createUnifiedAdapter(provider);
  return kit.unifiedBalance.getBalances({
    token: 'USDC',
    sources: { adapter, chains },
    includePending: true,
    networkType: 'testnet',
  });
}

window.ArqisSwap = {
  estimateSwapToUsdc,
  swapToUsdc,
  getSwapStatus,
  estimateUnifiedSpend,
  spendUnifiedBalance,
  depositUnifiedBalance,
  getUnifiedBalances,
};
