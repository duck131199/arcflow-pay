# Arc Testnet Setup

ArcFlow Pay currently targets Arc Testnet for prototype testing.

## Network Details

| Field | Value |
| --- | --- |
| Network | Arc Testnet |
| Chain ID | `5042002` |
| RPC URL | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| Currency | `USDC` |
| Circle Faucet | `https://faucet.circle.com` |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000` |

## Faucet

Use Circle Faucet to get testnet USDC for testing:

```text
https://faucet.circle.com
```

## Production Note

The faucet section is only useful for testnet onboarding. A production version should replace this with a normal wallet connection, network check, balance check, payment confirmation, and receipt flow.

## Receive USDC

For direct Arc Testnet asset transfers, show a separate wallet receive address and wallet QR.

- Network: Arc Testnet
- Assets: USDC, EURC, cirBTC
- Wallet address: 0xc6ad4a7fe3fd322968e1472c6d3ea6b0f2f2202d

Important distinction:

- Wallet QR = direct receive address only
- Invoice QR = invoice-specific payment request with amount, memo/order ID, reference code, and expiry

Direct wallet transfers are useful for testing and receiving funds, but invoice payments should use Create Invoice so the seller can track order/payment history.

Note: ArcFlow Pay still treats USDC as the primary invoice settlement asset. EURC and cirBTC are useful test assets for future FX, routing, and multi-asset payment experiments.
