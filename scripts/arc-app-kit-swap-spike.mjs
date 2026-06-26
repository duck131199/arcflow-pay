#!/usr/bin/env node
/**
 * Arqis 4A.0 — Circle App Kit Swap route probe / tiny swap spike.
 *
 * Server-side only. Never expose KIT_KEY, PRIVATE_KEY, CIRCLE_API_KEY, or
 * CIRCLE_ENTITY_SECRET in browser code or NEXT_PUBLIC_* env vars.
 *
 * Default mode only runs estimateSwap() for Arc Testnet routes:
 *   USDC -> EURC, EURC -> USDC, cirBTC -> USDC
 *
 * To execute a tiny real swap, pass --execute and set SWAP_EXECUTE_ROUTE.
 */
import 'dotenv/config';
import { AppKit } from '@circle-fin/app-kit';
import { ArcTestnet } from '@circle-fin/app-kit/chains';
import { createViemAdapterFromPrivateKey } from '@circle-fin/adapter-viem-v2';
import { createCircleWalletsAdapter } from '@circle-fin/adapter-circle-wallets';
import { createPublicClient, formatUnits, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const execute = process.argv.includes('--execute');
const acknowledgedExecution = process.argv.includes('--i-understand-this-executes-swap');
const adapterKind = (process.env.SWAP_ADAPTER || 'viem-private-key').trim();
const kitKey = process.env.KIT_KEY;

const defaultRoutes = [
  { label: 'sanity-usdc-to-eurc', tokenIn: 'USDC', tokenOut: 'EURC', amountIn: '1.00' },
  { label: 'main-eurc-to-usdc', tokenIn: 'EURC', tokenOut: 'USDC', amountIn: '1.00' },
  { label: 'optional-cirbtc-to-usdc', tokenIn: 'cirBTC', tokenOut: 'USDC', amountIn: '0.0001' },
];

const tokenMeta = {
  USDC: { decimals: 6, address: ArcTestnet.usdcAddress, nativeGas: true },
  EURC: { decimals: 6, address: ArcTestnet.eurcAddress, nativeGas: false },
  cirBTC: { decimals: 8, address: '0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF', nativeGas: false },
};

const arcViemChain = {
  id: ArcTestnet.chainId,
  name: ArcTestnet.name,
  nativeCurrency: ArcTestnet.nativeCurrency,
  rpcUrls: { default: { http: ArcTestnet.rpcEndpoints }, public: { http: ArcTestnet.rpcEndpoints } },
  blockExplorers: { default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' } },
  testnet: true,
};

const erc20BalanceAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.includes('replace_') || value.includes('your_') || value === '***') {
    throw new Error(`Missing required env ${name}`);
  }
  return value;
}

function assertNoClientPublicSecrets() {
  const badKeys = Object.keys(process.env).filter((key) =>
    key.startsWith('NEXT_PUBLIC_') && /KIT_KEY|PRIVATE_KEY|CIRCLE_API_KEY|CIRCLE_ENTITY_SECRET/i.test(key)
  );
  if (badKeys.length > 0) {
    throw new Error(`Unsafe browser-visible secret env detected: ${badKeys.join(', ')}`);
  }
}

function normalizePrivateKey(privateKey) {
  return privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
}

function normalizeError(err) {
  return {
    name: err?.name ?? null,
    code: err?.code ?? null,
    type: err?.type ?? null,
    recoverability: err?.recoverability ?? null,
    message: err?.message ?? String(err),
    causeTrace: err?.cause?.trace ?? null,
  };
}

function summarizeEstimate(estimate) {
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
    fees: estimate?.fees ?? [],
  };
}

function summarizeSwapResult(result) {
  return {
    tokenIn: result?.tokenIn,
    tokenOut: result?.tokenOut,
    amountIn: result?.amountIn,
    amountOut: result?.amountOut ?? null,
    chainIn: result?.chainIn,
    chainOut: result?.chainOut,
    fromAddress: result?.fromAddress,
    toAddress: result?.toAddress,
    txHash: result?.txHash,
    explorerUrl: result?.explorerUrl ?? null,
    fees: result?.fees ?? [],
    progress: result?.progress,
    config: result?.config ?? null,
  };
}

function createAdapter() {
  if (adapterKind === 'circle-wallets') {
    return {
      adapter: createCircleWalletsAdapter({
        apiKey: requireEnv('CIRCLE_API_KEY'),
        entitySecret: requireEnv('CIRCLE_ENTITY_SECRET'),
      }),
      address: requireEnv('CIRCLE_WALLET_ADDRESS'),
      includeAddressInSwapParams: true,
      canReadBalances: false,
    };
  }

  if (adapterKind === 'viem-private-key') {
    const privateKey = normalizePrivateKey(requireEnv('PRIVATE_KEY'));
    const account = privateKeyToAccount(privateKey);
    return {
      adapter: createViemAdapterFromPrivateKey({
        privateKey,
        capabilities: {
          addressContext: 'user-controlled',
          supportedChains: [ArcTestnet],
        },
      }),
      address: account.address,
      includeAddressInSwapParams: false,
      canReadBalances: true,
    };
  }

  throw new Error(`Unsupported SWAP_ADAPTER=${adapterKind}. Use viem-private-key or circle-wallets.`);
}

function makeSwapParams(route, adapterBundle) {
  return {
    from: {
      adapter: adapterBundle.adapter,
      chain: 'Arc_Testnet',
      ...(adapterBundle.includeAddressInSwapParams ? { address: adapterBundle.address } : {}),
    },
    tokenIn: route.tokenIn,
    tokenOut: route.tokenOut,
    amountIn: route.amountIn,
    config: {
      kitKey,
      slippageBps: Number(process.env.SWAP_SLIPPAGE_BPS || 300),
      // Default SDK behavior is permit with fallback to approve. Set
      // SWAP_ALLOWANCE_STRATEGY=approve for deterministic approval testing.
      ...(process.env.SWAP_ALLOWANCE_STRATEGY
        ? { allowanceStrategy: process.env.SWAP_ALLOWANCE_STRATEGY }
        : {}),
    },
  };
}

async function readTokenBalance(publicClient, address, symbol) {
  const meta = tokenMeta[symbol];
  if (!meta?.address) return null;

  if (meta.nativeGas) {
    const balance = await publicClient.getBalance({ address });
    return { symbol, raw: balance.toString(), amount: formatUnits(balance, ArcTestnet.nativeCurrency.decimals), decimals: ArcTestnet.nativeCurrency.decimals, nativeGas: true };
  }

  const balance = await publicClient.readContract({
    address: meta.address,
    abi: erc20BalanceAbi,
    functionName: 'balanceOf',
    args: [address],
  });
  return { symbol, raw: balance.toString(), amount: formatUnits(balance, meta.decimals), decimals: meta.decimals, nativeGas: false };
}

async function preflight(adapterBundle, routes) {
  const info = {
    adapter: adapterKind,
    address: adapterBundle.address ?? '(adapter-managed)',
    chain: {
      name: ArcTestnet.name,
      chain: ArcTestnet.chain,
      chainId: ArcTestnet.chainId,
      rpc: ArcTestnet.rpcEndpoints[0],
      explorer: 'https://testnet.arcscan.app',
    },
    tokens: tokenMeta,
  };
  console.log('PREFLIGHT');
  console.log(JSON.stringify(info, null, 2));

  if (!adapterBundle.canReadBalances || !adapterBundle.address) {
    console.log('BALANCE_CHECK_SKIPPED', JSON.stringify({ reason: 'Balance preflight is currently implemented for viem-private-key adapter only.' }));
    return;
  }

  const publicClient = createPublicClient({ chain: arcViemChain, transport: http(ArcTestnet.rpcEndpoints[0]) });
  const neededSymbols = [...new Set(['USDC', ...routes.map((route) => route.tokenIn)])];
  const balances = [];
  for (const symbol of neededSymbols) {
    try {
      balances.push(await readTokenBalance(publicClient, adapterBundle.address, symbol));
    } catch (err) {
      balances.push({ symbol, error: normalizeError(err) });
    }
  }
  console.log('BALANCES');
  console.log(JSON.stringify(balances, null, 2));
}

function validateExecuteSafety(routes) {
  if (!execute) return;
  if (!acknowledgedExecution) {
    throw new Error('Execution requires --i-understand-this-executes-swap in addition to --execute.');
  }
  if (routes.length !== 1) {
    throw new Error('Execution requires SWAP_ROUTE to select exactly one route.');
  }
  if (process.env.SWAP_EXECUTE_ROUTE !== routes[0].label) {
    throw new Error(`Execution requires SWAP_EXECUTE_ROUTE=${routes[0].label}.`);
  }
  if (process.env.SWAP_CONFIRM_ARC_TESTNET !== 'yes') {
    throw new Error('Execution requires SWAP_CONFIRM_ARC_TESTNET=yes.');
  }
}

async function main() {
  assertNoClientPublicSecrets();
  if (!kitKey || kitKey.includes('replace_') || kitKey === '***') throw new Error('Missing required env KIT_KEY');

  const kit = new AppKit();
  const adapterBundle = createAdapter();
  const routeFilter = process.env.SWAP_ROUTE;
  const routes = routeFilter
    ? defaultRoutes.filter((route) => route.label === routeFilter)
    : defaultRoutes;

  if (routes.length === 0) {
    throw new Error(`No route matched SWAP_ROUTE=${routeFilter}. Known: ${defaultRoutes.map((r) => r.label).join(', ')}`);
  }
  validateExecuteSafety(routes);

  console.log(JSON.stringify({
    spike: 'arqis-4a0-circle-app-kit-swap',
    mode: execute ? 'estimate+execute' : 'estimate-only',
    adapter: adapterKind,
    chain: 'Arc_Testnet',
    routes: routes.map(({ label, tokenIn, tokenOut, amountIn }) => ({ label, tokenIn, tokenOut, amountIn })),
    warning: 'Server-side only. Do not expose KIT_KEY in browser/NEXT_PUBLIC env.',
  }, null, 2));

  await preflight(adapterBundle, routes);

  for (const route of routes) {
    const params = makeSwapParams(route, adapterBundle);
    console.log(`\n== ${route.label}: ${route.tokenIn} -> ${route.tokenOut} amount ${route.amountIn} ==`);

    try {
      const estimate = await kit.estimateSwap(params);
      console.log('ESTIMATE_OK');
      console.log(JSON.stringify(summarizeEstimate(estimate), null, 2));

      if (execute) {
        console.log('EXECUTE_START', JSON.stringify({ route: route.label, note: 'Real Arc Testnet transaction may be sent.' }));
        const result = await kit.swap(params);
        console.log('SWAP_RESULT');
        console.log(JSON.stringify(summarizeSwapResult(result), null, 2));

        if (result?.txHash) {
          try {
            const status = await kit.getSwapStatus({
              txHash: result.txHash,
              chainIn: result.chainIn,
              chainOut: result.chainOut,
              kitKey,
            });
            console.log('STATUS_RESULT');
            console.log(JSON.stringify(status, null, 2));
          } catch (statusErr) {
            console.log('STATUS_ERROR');
            console.log(JSON.stringify(normalizeError(statusErr), null, 2));
          }
        }
      }
    } catch (err) {
      console.log('ROUTE_FAIL');
      console.log(JSON.stringify(normalizeError(err), null, 2));
    }
  }
}

main().catch((err) => {
  console.error('SPIKE_FATAL');
  console.error(JSON.stringify(normalizeError(err), null, 2));
  process.exit(1);
});
