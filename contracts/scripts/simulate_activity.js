import pkg from "hardhat";
const { ethers } = pkg;
import dotenv from "dotenv";

dotenv.config();

// Contract addresses from latest deployment (Track 2 - Final)
const VAULT_ADDRESS = "0xf4B146FbA71F41E0592668ffbF264F1D186b2Ca8";
const DOT_ADDRESS = "0x51A1ceB83B83F1985a81C295d1fF28Afef186E02";
const USDC_ADDRESS = "0x36b58F5C1969B7b6591D752ea6F5486D069010AB";

async function main() {
  const [signer, user] = await ethers.getSigners();
  console.log("Simulating activity with account:", user.address);

  const vault = (await ethers.getContractAt("AutoTreasury", VAULT_ADDRESS)).connect(user);
  const dot = (await ethers.getContractAt("MockERC20", DOT_ADDRESS)).connect(user);
  const usdc = (await ethers.getContractAt("MockERC20", USDC_ADDRESS)).connect(user);

  // 1. Mint & Approve DOT
  console.log("\n1. Depositing 1000 DOT...");
  const dotAmount = ethers.parseEther("1000");
  await (await dot.mint(user.address, dotAmount)).wait();
  await (await dot.approve(VAULT_ADDRESS, dotAmount)).wait();
  await (await vault.deposit(DOT_ADDRESS, dotAmount)).wait();
  console.log("   Done.");

  // 2. Mint & Approve USDC
  console.log("\n2. Depositing 2500 USDC...");
  const usdcAmount = ethers.parseEther("2500");
  await (await usdc.mint(user.address, usdcAmount)).wait();
  await (await usdc.approve(VAULT_ADDRESS, usdcAmount)).wait();
  await (await vault.deposit(USDC_ADDRESS, usdcAmount)).wait();
  console.log("   Done.");

  // 3. Status Check
  const tvl = await vault.totalAssets();
  const shares = await vault.shares(user.address);
  console.log("\nVault Stats After Deposits:");
  console.log("   TVL:   ", ethers.formatEther(tvl));
  console.log("   Shares:", ethers.formatEther(shares));

  // 4. Trigger Rebalance manually (though monitor might beat us to it)
  console.log("\n3. Triggering Rebalance...");
  try {
    const tx = await vault.rebalance();
    await tx.wait();
    console.log("   Rebalance Complete.");
  } catch (e) {
    console.log("   Rebalance failed (likely already done by monitor or unauthorized):", e.message.slice(0, 50));
  }

  console.log("\n═══════════════════════════════════════");
  console.log("  SIMULATION COMPLETE");
  console.log("═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
