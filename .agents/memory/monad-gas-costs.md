---
name: Monad Testnet Gas Costs
description: Gas fees on Monad testnet are dramatically higher than expected — ~0.225 MON per transaction during congestion, not 0.001-0.01 MON like other testnets.
---

## Rule
Monad testnet gas is ~0.225 MON/tx under normal conditions (July 2026).
Never assume "a few gwei" — budget 0.3 MON per transaction to be safe.

## Why
Empirically observed: investor wallet spent 0.831 MON on 3 transactions + 0.155 MON in value transfers.
(0.831 - 0.155) / 3 ≈ 0.225 MON/tx in gas.

## How to Apply
- Hardhat seed scripts: fund builder wallets with at LEAST 1.0 MON if they need 4+ transactions.
- Any script that creates agreements, deposits, or calls contract functions: budget 0.3 MON per tx.
- The faucet gives 1 MON. This only covers 3-4 transactions. Get multiple faucet drops before seeding.
- `eth_getLogs` is also rate-limited to 100-block ranges on Monad testnet. Chunk calls to ≤99 blocks each.
