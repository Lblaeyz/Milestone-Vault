---
name: Monad Testnet RPC Limits
description: Monad testnet RPC caps eth_getLogs at 100 blocks per call. Naive fromBlock=0 calls fail with -32614.
---

## Rule
Never call `eth_getLogs` with `fromBlock: 0n, toBlock: 'latest'` on Monad testnet.
Split into 99-block chunks and fetch in parallel batches.

## Why
RPC returns error code -32614: "eth_getLogs is limited to a 100 range".

## How to Apply
```ts
const latestBlock = await publicClient.getBlockNumber();
const LOOKBACK = 1500n;  // ~25 min at 1s/block — adjust as needed
const CHUNK = 99n;
const fromBlock = latestBlock > LOOKBACK ? latestBlock - LOOKBACK : 0n;

const chunks: Array<{from: bigint; to: bigint}> = [];
for (let f = fromBlock; f <= latestBlock; f += CHUNK + 1n) {
  chunks.push({ from: f, to: f + CHUNK <= latestBlock ? f + CHUNK : latestBlock });
}

const results = await Promise.all(
  chunks.map(c =>
    publicClient.getLogs({ address, fromBlock: c.from, toBlock: c.to })
      .catch(() => [] as any[])
  )
);
const allLogs = results.flat();
```

Keep LOOKBACK ≤ 1500 blocks (15 chunks) to stay under the RPC rate limit.
Batching 200+ chunks causes 429 Too Many Requests.
