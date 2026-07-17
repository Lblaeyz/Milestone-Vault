/**
 * seed.ts — Creates a realistic demo agreement on Monad Testnet.
 *
 * Demo state after seeding:
 *   Milestone 1 (30%) — Approved  (green)
 *   Milestone 2 (40%) — Disputed  (red)
 *   Milestone 3 (30%) — Pending   (dark)
 *
 * Generates a fresh builder wallet, funds it from the investor wallet,
 * then drives the full lifecycle: create → deposit → accept → request →
 * approve → request → reject → dispute.
 *
 * Usage:
 *   cd contracts
 *   PRIVATE_KEY=0x... ARBITER_ADDRESS=0x... MONAD_RPC_URL=https://testnet-rpc.monad.xyz \
 *   HARDHAT_DISABLE_TELEMETRY_PROMPT=true \
 *   npx hardhat run scripts/seed.ts --network monadTestnet
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const FACTORY_ADDRESS =
  process.env.FACTORY_ADDRESS ||
  "0x1AD5A34e16541a52eF91D1E81bd86d6c35C1D1fC";

const API_BASE =
  process.env.API_BASE || "http://localhost:80";

async function post(url: string, body: unknown) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`  POST ${url} => ${res.status}: ${text}`);
    }
    return await res.json().catch(() => null);
  } catch (err) {
    console.warn(`  Could not reach API (${url}):`, (err as Error).message);
    return null;
  }
}

async function main() {
  const [investor] = await ethers.getSigners();
  console.log("Investor wallet:", investor.address);

  const balance = await ethers.provider.getBalance(investor.address);
  console.log("Balance:", ethers.formatEther(balance), "MON");

  if (balance < ethers.parseEther("0.2")) {
    throw new Error("Investor wallet needs at least 0.2 MON (deposit + gas + builder funding)");
  }

  // ── Generate builder wallet ──────────────────────────────────────────────────
  const builderWallet = ethers.Wallet.createRandom().connect(ethers.provider);
  console.log("\nBuilder wallet (generated):", builderWallet.address);

  // Fund builder generously — Monad testnet gas is expensive (~0.02 MON/tx)
  // Need: accept + 2x requestPayout + raiseDispute = 4 txs = ~0.08 MON minimum
  console.log("Funding builder with 0.1 MON for gas...");
  const fundTx = await investor.sendTransaction({
    to: builderWallet.address,
    value: ethers.parseEther("0.1"),
  });
  await fundTx.wait();
  console.log("  Builder funded");

  // ── Get factory ──────────────────────────────────────────────────────────────
  const factory = await ethers.getContractAt(
    "MilestoneVaultFactory",
    FACTORY_ADDRESS,
    investor
  );

  // ── Create agreement ─────────────────────────────────────────────────────────
  const projectName = "DeFi Dashboard MVP";
  const description =
    "A full-stack DeFi analytics dashboard with on-chain data indexing, " +
    "customizable widgets, and multi-chain portfolio tracking. Three milestones: " +
    "design + architecture, core implementation, testing + delivery.";

  const milestoneDescriptions = [
    "Design, architecture & scaffolding",
    "Core implementation — data indexing, UI components, routing",
    "Testing, audit-readiness & production deployment",
  ];
  const milestonePercentages = [30n, 40n, 30n];

  console.log("\nCreating agreement on-chain...");
  const createTx = await factory.createAgreement(
    builderWallet.address,
    milestoneDescriptions,
    milestonePercentages
  );
  const createReceipt = await createTx.wait();
  if (!createReceipt) throw new Error("Create tx failed");

  // ── Find vault address from VaultCreated event ───────────────────────────────
  let vaultAddress: string | undefined;
  for (const log of createReceipt.logs) {
    try {
      const parsed = factory.interface.parseLog({
        topics: [...log.topics],
        data: log.data,
      });
      if (parsed?.name === "VaultCreated") {
        vaultAddress = parsed.args.vault as string;
        break;
      }
    } catch { /* skip non-factory logs */ }
  }

  if (!vaultAddress) {
    throw new Error("VaultCreated event not found in receipt logs");
  }
  console.log("Vault deployed:", vaultAddress);
  console.log("Tx:", createReceipt.hash);

  // ── Deposit 0.15 MON ─────────────────────────────────────────────────────────
  const vault = await ethers.getContractAt("MilestoneVault", vaultAddress, investor);
  const builderVault = vault.connect(builderWallet) as any;

  console.log("\nDepositing 0.15 MON...");
  const depositTx = await vault.deposit({ value: ethers.parseEther("0.15") });
  await depositTx.wait();
  console.log("  Deposited. Tx:", depositTx.hash);

  // ── Builder accepts ──────────────────────────────────────────────────────────
  console.log("\nBuilder accepting agreement...");
  const acceptTx = await builderVault.acceptAgreement();
  await acceptTx.wait();
  console.log("  Accepted. Tx:", acceptTx.hash);

  // ── Milestone 0: request → approve ──────────────────────────────────────────
  console.log("\nBuilder requesting milestone 1 payout (30%)...");
  const req0Tx = await builderVault.requestMilestonePayout(
    0,
    "https://github.com/demo/milestone-1-design-complete"
  );
  await req0Tx.wait();
  console.log("  Requested. Tx:", req0Tx.hash);

  console.log("Investor approving milestone 1...");
  const approve0Tx = await vault.approveRequest(0);
  await approve0Tx.wait();
  console.log("  Approved. Tx:", approve0Tx.hash, "— 0.045 MON released");

  // ── Milestone 1: request → reject → dispute ──────────────────────────────────
  console.log("\nBuilder requesting milestone 2 payout (40%)...");
  const req1Tx = await builderVault.requestMilestonePayout(
    1,
    "https://github.com/demo/milestone-2-implementation"
  );
  await req1Tx.wait();
  console.log("  Requested. Tx:", req1Tx.hash);

  console.log("Investor rejecting milestone 2 (quality dispute)...");
  const reject1Tx = await vault.rejectRequest(1);
  await reject1Tx.wait();
  console.log("  Rejected. Tx:", reject1Tx.hash);

  console.log("Builder raising dispute on milestone 2...");
  const dispute1Tx = await builderVault.raiseDispute(1);
  await dispute1Tx.wait();
  console.log("  Disputed. Tx:", dispute1Tx.hash);

  // ── Save off-chain metadata to API ───────────────────────────────────────────
  console.log("\nSaving metadata to API server...");
  const meta = await post(`${API_BASE}/api/agreements`, {
    contractAddress: vaultAddress.toLowerCase(),
    investorAddress: investor.address.toLowerCase(),
    builderAddress: builderWallet.address.toLowerCase(),
    projectName,
    description,
    txHash: createReceipt.hash,
    chainId: 10143,
  });

  if (meta?.contractAddress) {
    // Save request metadata
    await post(`${API_BASE}/api/agreements/${vaultAddress.toLowerCase()}/requests`, {
      onchainRequestId: 0,
      requestType: "milestone",
      milestoneIndex: 0,
      evidenceUrl: "https://github.com/demo/milestone-1-design-complete",
    });
    await post(`${API_BASE}/api/agreements/${vaultAddress.toLowerCase()}/requests`, {
      onchainRequestId: 1,
      requestType: "milestone",
      milestoneIndex: 1,
      evidenceUrl: "https://github.com/demo/milestone-2-implementation",
    });
    console.log("  API metadata saved");
  } else {
    console.warn("  API save failed or returned unexpected response (API server may not be running)");
    console.warn("  Vault is still live on-chain — metadata can be re-created via the frontend");
  }

  // ── Write seed info to frontend for easy access ───────────────────────────────
  const seedInfo = {
    vaultAddress,
    investorAddress: investor.address,
    builderAddress: builderWallet.address,
    projectName,
    description,
    createTxHash: createReceipt.hash,
    depositAmount: "0.15 MON",
    state: {
      milestone1: "Approved (0.045 MON released)",
      milestone2: "Disputed (arbiter intervention needed)",
      milestone3: "Pending (not yet requested)",
    },
    dashboardUrl: `/agreement/${vaultAddress}`,
    explorerUrl: `https://testnet.monadscan.com/address/${vaultAddress}`,
    seededAt: new Date().toISOString(),
  };

  const outPath = path.resolve(__dirname, "../../artifacts/milestone-vault/src/contracts/seedInfo.json");
  fs.writeFileSync(outPath, JSON.stringify(seedInfo, null, 2));
  console.log("\nSeed info written to:", outPath);

  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  DEMO AGREEMENT SEEDED SUCCESSFULLY");
  console.log("════════════════════════════════════════════════════════════");
  console.log("  Vault:     ", vaultAddress);
  console.log("  Investor:  ", investor.address);
  console.log("  Builder:   ", builderWallet.address);
  console.log("  Dashboard: /agreement/" + vaultAddress);
  console.log("  Explorer:  https://testnet.monadscan.com/address/" + vaultAddress);
  console.log("\n  State:");
  console.log("    Milestone 1 (30%): Approved  — 0.045 MON released to builder");
  console.log("    Milestone 2 (40%): Disputed  — awaiting arbiter resolution");
  console.log("    Milestone 3 (30%): Pending   — not yet requested");
  console.log("════════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("\nSeed failed:", err);
    process.exit(1);
  });
