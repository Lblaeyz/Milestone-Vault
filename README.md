# MilestoneVault

A milestone-based escrow dApp on **Monad Testnet**. Investors lock native MON tokens into a smart contract; builders request payouts as milestones complete; investors approve or reject; disputes escalate to a designated arbiter wallet. Every financial operation is a real on-chain transaction. The frontend reads chain state directly using wagmi/viem with no mocked or cached data.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Monad Testnet (chainId 10143, native MON) |
| Smart Contracts | Solidity 0.8.24, Hardhat 2.22 |
| Frontend | React 19 + Vite, Wagmi v2, RainbowKit v2, Viem v2 |
| Routing | Wouter |
| Animations | Framer Motion (activity feed only) |
| Off-chain metadata | Express 5 API + Replit PostgreSQL + Drizzle ORM |
| API codegen | Orval (from OpenAPI spec → typed React hooks) |
| Monorepo | pnpm workspaces |

---

## Deployed Contracts (Monad Testnet)

| Contract | Address |
|---|---|
| MilestoneVaultFactory | [`0x1AD5A34e16541a52eF91D1E81bd86d6c35C1D1fC`](https://testnet.monadscan.com/address/0x1AD5A34e16541a52eF91D1E81bd86d6c35C1D1fC) |
| Demo Vault | See `artifacts/milestone-vault/src/contracts/seedInfo.json` after seeding |
| Arbiter Wallet | `0x5a554d0b250Ec2fFd0796EBE053C1C2890A011dE` |

---

## Live URL

> Set after deployment to Replit or Vercel.

---

## How to Run Locally

### Prerequisites

- Node.js 20+, pnpm 10+
- A wallet with Monad Testnet MON ([faucet.monad.xyz](https://faucet.monad.xyz))

### 1. Install dependencies

```bash
pnpm install            # installs all workspace packages
cd contracts && npm install && cd ..
```

### 2. Set environment variables

Copy `.env.example` (or set in your shell):

```bash
# Shared across frontend and API
VITE_FACTORY_ADDRESS=0x1AD5A34e16541a52eF91D1E81bd86d6c35C1D1fC
VITE_ARBITER_ADDRESS=0x5a554d0b250Ec2fFd0796EBE053C1C2890A011dE
VITE_MONAD_RPC_URL=https://testnet-rpc.monad.xyz
VITE_CHAIN_ID=10143

# API server — Replit sets DATABASE_URL automatically
# If running outside Replit, set a Postgres connection string:
DATABASE_URL=postgresql://...
```

### 3. Start services

In separate terminals:

```bash
# Frontend (Vite dev server)
pnpm --filter @workspace/milestone-vault run dev

# API server (Express)
pnpm --filter @workspace/api-server run dev
```

The frontend auto-detects the API base URL via `import.meta.env.BASE_URL`.

### 4. Push database schema (first run only)

```bash
pnpm --filter @workspace/db run push
```

---

## Smart Contract Development

```bash
# Compile
cd contracts
HARDHAT_DISABLE_TELEMETRY_PROMPT=true npx hardhat compile

# Deploy to Monad Testnet (pass private key inline — never write to .env)
PRIVATE_KEY=0x... \
ARBITER_ADDRESS=0x5a554d0b250Ec2fFd0796EBE053C1C2890A011dE \
MONAD_RPC_URL=https://testnet-rpc.monad.xyz \
HARDHAT_DISABLE_TELEMETRY_PROMPT=true \
npx hardhat run scripts/deploy.ts --network monadTestnet

# Seed a demo agreement with a full lifecycle
PRIVATE_KEY=0x... \
ARBITER_ADDRESS=0x5a554d0b250Ec2fFd0796EBE053C1C2890A011dE \
MONAD_RPC_URL=https://testnet-rpc.monad.xyz \
FACTORY_ADDRESS=0x1AD5A34e16541a52eF91D1E81bd86d6c35C1D1fC \
HARDHAT_DISABLE_TELEMETRY_PROMPT=true \
npx hardhat run scripts/seed.ts --network monadTestnet
```

---

## Architecture

```
contracts/
  MilestoneVaultFactory.sol   — deploys one MilestoneVault per agreement
  MilestoneVault.sol          — escrow logic: deposit, milestones, disputes

lib/
  api-spec/openapi.yaml       — OpenAPI spec (source of truth)
  api-client-react/           — generated React hooks (Orval)
  db/                         — Drizzle schema + migrations

artifacts/
  api-server/                 — Express API: off-chain metadata only
  milestone-vault/            — React + Vite frontend
    src/contracts/            — ABIs + chain config (written by deploy script)
    src/pages/                — home, create, agreement, agreements, arbiter
    src/lib/wagmi.ts          — Wagmi + RainbowKit config for Monad Testnet
```

**Data flow:**
- Balances, milestone status, request state — read directly from chain via `useReadContracts`
- Every write (deposit, approve, reject, dispute, resolve) waits for `waitForTransactionReceipt` before updating UI
- Activity feed — fetched from chain logs via `publicClient.getLogs` + live updates via `useWatchContractEvent`
- Project metadata (name, description, evidence links) — stored in the API + PostgreSQL

---

## Demo Instructions (step-by-step)

The demo agreement is pre-seeded on Monad Testnet. Find the vault address in `artifacts/milestone-vault/src/contracts/seedInfo.json`.

### Scenario A — Spectator view (no wallet)

1. Open the app. Click any agreement address or navigate to `/agreement/<vault-address>`
2. See the live on-chain state: balances in MON (monospace), segmented milestone progress bar (green = approved, amber = pending, red = disputed), full activity feed pulled from chain logs
3. No wallet required to read state

### Scenario B — Builder requests a milestone payout

1. Connect the **builder wallet** (see `seedInfo.json` for the generated builder address — you won't have its private key, so create a fresh agreement instead)
2. Navigate to `/create`, fill the form, click **Create & Deposit**
   - Watch the status update: "Creating agreement on-chain..." → "Waiting for creation tx..." → "Depositing funds..." → "Waiting for deposit tx..." → "Done!"
   - You are redirected to the new vault dashboard
3. Switch to the **builder wallet**, open the dashboard
4. Click **Accept Agreement** (green banner at top) → confirm in wallet → UI updates only after block confirmation
5. Click **Request** next to Milestone 1 → enter an optional evidence URL → **Submit Request** → confirm → wait for receipt → status updates on-chain

### Scenario C — Investor approves or rejects

1. Connect the **investor wallet**, open the vault dashboard
2. In the "Requests" section, see the pending request with amount and evidence link
3. Click **Approve** → confirm → wait for receipt → milestone turns green in progress bar, MON released
4. Or click **Reject** → confirm → wait for receipt → builder can then raise a dispute

### Scenario D — Builder raises a dispute

1. Connect the **builder wallet**, open the dashboard
2. Find the rejected request, click **Raise Dispute** → confirm → wait for receipt
3. Agreement enters Disputed state — amber banner appears

### Scenario E — Arbiter resolves dispute

1. Connect the **arbiter wallet** (`0x5a554d0b250Ec2fFd0796EBE053C1C2890A011dE`)
2. Navigate to `/arbiter` — the panel loads all disputed agreements
3. Review evidence link, click **Release to Builder** or **Deny** → confirm → wait for receipt
4. Dispute is resolved on-chain; activity feed updates with the resolution event

### Scenario F — Full pre-seeded demo (judges)

Open `/agreement/<address from seedInfo.json>`:
- **Progress bar**: Milestone 1 (30%) green, Milestone 2 (40%) red/disputed, Milestone 3 (30%) dark
- **Activity feed**: 7 on-chain events from actual transactions (create, deposit, accept, request ×2, approve, reject, dispute)
- **Balances**: 0.045 MON released, ~0.105 MON locked in escrow

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| Native MON only (no ERC20) | Avoids token approval complexity for MVP |
| Factory pattern | One isolated vault per agreement — no shared state risk |
| All reads from chain | No stale cache; every balance and status is live |
| All writes wait for `waitForTransactionReceipt` | No fake success toasts; UI only updates on confirmation |
| Off-chain DB for metadata only | Names, descriptions, evidence links — nothing financial |
| Spectator mode by default | Dashboards are public; wallet only required for writes |
