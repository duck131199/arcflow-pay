const SOURCE_CHAIN_PRIORITY = ['ethereum-sepolia', 'base-sepolia', 'avalanche-fuji'];
const PREPARE_BUFFER_PERCENT = 0.02;
const PREPARE_BUFFER_MIN = 0.05;
const PREPARE_BUFFER_MAX = 1;

function sourceChainRank(item) {
  const index = SOURCE_CHAIN_PRIORITY.indexOf(item?.key);
  return index === -1 ? SOURCE_CHAIN_PRIORITY.length : index;
}

export function planUnifiedInvoicePayment({ amount, balances, settlementChain = 'arc-testnet', invoiceAmount }) {
  const baseAmountNeeded = Math.max(0, Number(amount || 0));
  const safetyBuffer = baseAmountNeeded
    ? Math.min(PREPARE_BUFFER_MAX, Math.max(baseAmountNeeded * PREPARE_BUFFER_PERCENT, PREPARE_BUFFER_MIN))
    : 0;
  const amountNeeded = baseAmountNeeded + safetyBuffer;
  const totalDue = Math.max(0, Number(invoiceAmount ?? baseAmountNeeded));
  const allBalances = (balances || [])
    .map((item) => ({
      ...item,
      balance: Number(item.balance || 0),
    }));
  const arcRow = allBalances.find((item) => item.key === settlementChain || item.settlement);
  const arcBalance = Number(arcRow?.balance || 0);
  const sourceChains = allBalances
    .filter((item) => item.key !== settlementChain && !item.settlement);
  const availableAcrossSources = sourceChains.reduce((sum, item) => sum + item.balance, 0);
  const sources = sourceChains
    .filter((item) => item.balance > 0)
    .sort((a, b) => {
      if (a.key === settlementChain && b.key !== settlementChain) return -1;
      if (b.key === settlementChain && a.key !== settlementChain) return 1;
      const priority = sourceChainRank(a) - sourceChainRank(b);
      if (priority !== 0) return priority;
      return b.balance - a.balance;
    });

  if (!baseAmountNeeded || baseAmountNeeded <= 0) {
    return {
      amountNeeded,
      due: amountNeeded,
      baseAmountNeeded,
      safetyBuffer,
      invoiceAmount: totalDue,
      arcBalance,
      sourceChains,
      selectedSources: [],
      rows: sourceChains.map((item) => ({ ...item, use: 0 })),
      covered: false,
      canPayFromArc: totalDue > 0 && arcBalance >= totalDue,
      needsChainToChain: false,
      missingAmount: amountNeeded,
      remaining: amountNeeded,
      signatures: 0,
      sourceCount: 0,
      availableAcrossSources,
      settlementChain,
      strategy: 'none',
    };
  }

  const canPayFromArc = arcBalance >= totalDue;
  if (canPayFromArc) {
    const rows = sourceChains.map((item) => ({ ...item, use: 0 }));
    return {
      amountNeeded,
      due: amountNeeded,
      baseAmountNeeded,
      safetyBuffer,
      invoiceAmount: totalDue,
      arcBalance,
      sourceChains,
      selectedSources: [],
      rows,
      covered: true,
      canPayFromArc: true,
      needsChainToChain: false,
      missingAmount: 0,
      remaining: 0,
      signatures: 0,
      sourceCount: 0,
      availableAcrossSources,
      strategy: 'settlement-chain',
      settlementChain,
    };
  }

  const single = sources.find((item) => item.balance >= amountNeeded);
  const selected = single ? [single] : sources;
  let remaining = amountNeeded;
  const used = [];

  for (const source of selected) {
    if (remaining <= 0) break;
    const use = Math.min(source.balance, remaining);
    if (use > 0) used.push({ ...source, use });
    remaining = Math.max(0, remaining - use);
  }

  const rows = sourceChains.map((item) => {
    const match = used.find((source) => source.key === item.key);
    return { ...item, use: match ? match.use : 0 };
  });
  const selectedSources = rows.filter((item) => item.use > 0);
  const missingAmount = Math.max(0, remaining);

  return {
    amountNeeded,
    due: amountNeeded,
    baseAmountNeeded,
    safetyBuffer,
    invoiceAmount: totalDue,
    arcBalance,
    sourceChains,
    selectedSources,
    rows,
    covered: missingAmount <= 0,
    canPayFromArc,
    needsChainToChain: selectedSources.length > 0,
    missingAmount,
    remaining: missingAmount,
    signatures: used.length,
    sourceCount: used.length,
    availableAcrossSources,
    strategy: single ? 'single-source' : 'fewest-sources',
    settlementChain,
  };
}
