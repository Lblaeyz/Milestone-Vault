import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MON");

  // ── Deploy MilestoneVaultFactory ──────────────────────────────────────────
  const arbiterAddress = process.env.ARBITER_ADDRESS;
  if (!arbiterAddress) {
    throw new Error("ARBITER_ADDRESS env var not set");
  }

  console.log("\nDeploying MilestoneVaultFactory...");
  const Factory = await ethers.getContractFactory("MilestoneVaultFactory");
  const factory = await Factory.deploy(arbiterAddress);
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log("MilestoneVaultFactory deployed to:", factoryAddress);

  // ── Write ABI + addresses to frontend ────────────────────────────────────
  const deployInfo = {
    factoryAddress,
    arbiterAddress,
    chainId: 10143,
    network: "monadTestnet",
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  const outDir = path.resolve(__dirname, "../..", "artifacts/milestone-vault/src/contracts");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Write deploy info
  fs.writeFileSync(
    path.join(outDir, "deployInfo.json"),
    JSON.stringify(deployInfo, null, 2)
  );

  // Copy ABI files
  const artifactsDir = path.resolve(__dirname, "../artifacts/contracts");
  copyABI(artifactsDir, "MilestoneVaultFactory.sol/MilestoneVaultFactory.json", outDir, "MilestoneVaultFactory.json");
  copyABI(artifactsDir, "MilestoneVault.sol/MilestoneVault.json", outDir, "MilestoneVault.json");

  console.log("\n✓ Deployment info written to:", outDir);
  console.log("\n── Summary ──────────────────────────────────────────────────");
  console.log("Factory:", factoryAddress);
  console.log("Arbiter:", arbiterAddress);
  console.log("\nSet these env vars:");
  console.log(`NEXT_PUBLIC_FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`NEXT_PUBLIC_ARBITER_ADDRESS=${arbiterAddress}`);
}

function copyABI(artifactsDir: string, relPath: string, outDir: string, outName: string) {
  const src = path.join(artifactsDir, relPath);
  if (!fs.existsSync(src)) {
    console.warn("ABI not found:", src);
    return;
  }
  const artifact = JSON.parse(fs.readFileSync(src, "utf8"));
  fs.writeFileSync(
    path.join(outDir, outName),
    JSON.stringify({ abi: artifact.abi }, null, 2)
  );
  console.log("  Wrote ABI:", outName);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
