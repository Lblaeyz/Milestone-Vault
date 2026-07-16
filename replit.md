# MilestoneVault

A milestone-based escrow dApp on Monad Testnet. Investors lock native MON into smart contracts; builders request payouts per milestone; investors approve or reject; disputes escalate to an arbiter wallet. All money logic is on-chain. The frontend reads chain state via wagmi/viem and stores project metadata (names, descriptions, evidence links) in the built-in PostgreSQL database.

## Run & Operate

- `pnpm --filter @workspace/milestone-vault run dev` — run the frontend (Vite, port set by workflow)
- `pnpm --filter @workspace/api-server run dev` — run the API server (Express, port set by workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `cd contracts && HARDHAT_DISABLE_TELEMETRY_PROMPT=true npx hardhat compile` — compile Solidity contracts
- `cd contracts && PRIVATE_KEY=0x... ARBITER_ADDRESS=0x... MONAD_RPC_URL=https://testnet-rpc.monad.xyz HARDHAT_DISABLE_TELEMETRY_PROMPT=true npx hardhat run scripts/deploy.ts --network monadTestnet` — deploy to Monad Testnet

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite, Wagmi v2, RainbowKit v2, Viem v2, Wouter (routing)
- API: Express 5 (off-chain metadata only)
- DB: Replit built-in PostgreSQL + Drizzle ORM (agreement metadata, request metadata)
- Blockchain: Monad Testnet (chainId 10143, RPC: testnet-rpc.monad.xyz)
- Contracts: Solidity 0.8.24, Hardhat 2.22 (in `contracts/` directory)
- Validation: Zod, drizzle-zod
- API codegen: Orval (from OpenAPI spec)

## Where things live

- `contracts/contracts/MilestoneVault.sol` — escrow vault contract (one per agreement)
- `contracts/contracts/MilestoneVaultFactory.sol` — factory that deploys vault instances
- `contracts/scripts/deploy.ts` — deployment script
- `artifacts/milestone-vault/src/contracts/` — ABIs + chain config for the frontend
- `artifacts/milestone-vault/src/pages/` — frontend pages
- `artifacts/milestone-vault/src/lib/wagmi.ts` — wagmi/RainbowKit config
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `lib/db/src/schema/agreements.ts` — off-chain metadata DB schema
- `artifacts/api-server/src/routes/` — API route handlers

## Architecture decisions

- **Factory pattern**: `MilestoneVaultFactory` deploys one `MilestoneVault` per agreement. Each project has its own isolated fund pool.
- **Native MON only**: No ERC20 support for MVP — avoids approval complexity.
- **On-chain is truth**: All fund state (deposited, released, locked, milestone status) is read directly from chain via `useReadContracts`. The API only stores human-readable metadata.
- **Replit DB over Supabase**: Using built-in PostgreSQL via Drizzle for off-chain metadata. Works out-of-the-box with rollback support. Supabase can be swapped in later.
- **Spectator mode by default**: Dashboard reads are public — no wallet needed to view agreement state.

## Deployed Contracts (Monad Testnet)

- Factory: `0x1AD5A34e16541a52eF91D1E81bd86d6c35C1D1fC`
- Arbiter: `0x5a554d0b250Ec2fFd0796EBE053C1C2890A011dE`
- Explorer: https://testnet.monadscan.com/address/0x1AD5A34e16541a52eF91D1E81bd86d6c35C1D1fC

## User preferences

- Use native MON (no ERC20) for MVP
- Arbiter wallet resolves disputes (no DAO voting for MVP)
- Evidence/reason fields are text/URL inputs only (no file upload)
- Palette: #0A0A0B bg, #EDEDED text, #4ADE80 green, #F5A524 amber, #F87171 red
- Monospace font for all monetary values

## Gotchas

- Hardhat requires `HARDHAT_DISABLE_TELEMETRY_PROMPT=true` env var when running non-interactively
- Private key for deployment must be passed inline (env var injection), never written to .env file
- `VITE_FACTORY_ADDRESS` must be set after deployment for the frontend to enable contract interactions
- The `contracts/` directory is NOT a pnpm workspace package — use `npm install` or `npm run` inside it, not `pnpm --filter`
- Wagmi's `useReadContracts` returns results in index order — always destructure by position
- WalletConnect 403 warning in console is expected (demo projectId, not a real WalletConnect project)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Monad Testnet faucet: https://faucet.monad.xyz
- Monad Testnet explorer: https://testnet.monadscan.com
