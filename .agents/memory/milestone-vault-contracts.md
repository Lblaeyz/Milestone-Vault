---
name: MilestoneVault contract deployment
description: Notes on deploying Solidity contracts with Hardhat in non-interactive (shell/CI) environments on Replit
---

## Rule
Always set HARDHAT_DISABLE_TELEMETRY_PROMPT=true when running Hardhat commands non-interactively (ShellExec tool). Without it, Hardhat opens a readline prompt that crashes immediately.

**Why:** Hardhat v2.22 prompts for telemetry consent on first run. In non-interactive shells, readline closes immediately, causing ERR_USE_AFTER_CLOSE.

**How to apply:** Prefix every `npx hardhat` call: `HARDHAT_DISABLE_TELEMETRY_PROMPT=true npx hardhat compile`

## Private key handling
Cannot write to .env files on Replit (forbidden). Pass private key inline in shell command: `PRIVATE_KEY=0x... npx hardhat run scripts/deploy.ts --network X`

## Factory address
After deployment, set VITE_FACTORY_ADDRESS env var (not NEXT_PUBLIC_ — this is a Vite app). The deploy script in contracts/scripts/deploy.ts also copies compiled ABIs to artifacts/milestone-vault/src/contracts/.

## contracts/ directory
Is NOT a pnpm workspace package. Use `npm install` / `npm run` inside it, not `pnpm --filter`.
