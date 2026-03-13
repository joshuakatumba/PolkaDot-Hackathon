import pkg from "hardhat";
const { ethers } = pkg;
import dotenv from "dotenv";

dotenv.config();

// Contract addresses from latest deployment (Local Hardhat)
const VAULT_ADDRESS = "0x68B1D87F95878fE05B998F19b66F4baba5De1aed";
const DOT_ADDRESS = "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82";
const USDC_ADDRESS = "0x9A676e781A523b5d0C0e43731313A708CB607508";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  const signers = await ethers.getSigners();
  const owner = signers[0]; // Account #0 is the deployer/owner
  const users = signers.slice(1, 5); // Accounts #1-#4 are simulated users

  const vault = await ethers.getContractAt("AutoTreasury", VAULT_ADDRESS);
  const dot = await ethers.getContractAt("MockERC20", DOT_ADDRESS);
  const usdc = await ethers.getContractAt("MockERC20", USDC_ADDRESS);

  console.log("═══════════════════════════════════════");
  console.log("  DYNAMIC ACTIVITY SIMULATOR");
  console.log("  Owner:", owner.address);
  console.log("  Users:", users.length);
  console.log("═══════════════════════════════════════\n");

  // ── Initial Setup: Seed deposits & rebalance ──
  console.log("▶ Phase 1: Initial Deposits...\n");

  // Deposit DOT from multiple users
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const dotAmount = ethers.parseEther(String(randomBetween(500, 2000)));
    const usdcAmount = ethers.parseEther(String(randomBetween(1000, 5000)));

    await (await dot.connect(user).mint(user.address, dotAmount)).wait();
    await (await dot.connect(user).approve(VAULT_ADDRESS, dotAmount)).wait();
    await (await vault.connect(user).deposit(DOT_ADDRESS, dotAmount)).wait();
    console.log(`   User ${i+1} deposited ${ethers.formatEther(dotAmount)} DOT`);

    await (await usdc.connect(user).mint(user.address, usdcAmount)).wait();
    await (await usdc.connect(user).approve(VAULT_ADDRESS, usdcAmount)).wait();
    await (await vault.connect(user).deposit(USDC_ADDRESS, usdcAmount)).wait();
    console.log(`   User ${i+1} deposited ${ethers.formatEther(usdcAmount)} USDC`);
  }

  // ── Rebalance from Owner ──
  console.log("\n▶ Phase 2: Rebalancing Strategies...\n");
  try {
    const tx = await vault.connect(owner).rebalance();
    await tx.wait();
    console.log("   ✅ Rebalance Complete — Funds distributed to strategies!");
  } catch (e) {
    console.log("   ❌ Rebalance Error:", e.message.slice(0, 100));
  }

  // Show stats
  const tvl = await vault.totalAssets();
  console.log(`\n   📊 TVL: ${ethers.formatEther(tvl)} tokens`);

  // ── Phase 3: Continuous Dynamic Activity ──
  console.log("\n▶ Phase 3: Continuous Activity (Ctrl+C to stop)\n");

  let round = 0;
  while (true) {
    round++;
    const userIdx = randomBetween(0, users.length - 1);
    const user = users[userIdx];
    const action = randomBetween(1, 10);

    if (action <= 6) {
      // 60% chance: New Deposit
      const isDot = Math.random() > 0.5;
      const token = isDot ? dot : usdc;
      const tokenName = isDot ? "DOT" : "USDC";
      const tokenAddr = isDot ? DOT_ADDRESS : USDC_ADDRESS;
      const amount = ethers.parseEther(String(randomBetween(100, 1500)));

      await (await token.connect(user).mint(user.address, amount)).wait();
      await (await token.connect(user).approve(VAULT_ADDRESS, amount)).wait();
      await (await vault.connect(user).deposit(tokenAddr, amount)).wait();
      console.log(`   [Round ${round}] 💰 User ${userIdx+1} deposited ${ethers.formatEther(amount)} ${tokenName}`);

    } else if (action <= 8) {
      // 20% chance: Rebalance
      try {
        const tx = await vault.connect(owner).rebalance();
        await tx.wait();
        console.log(`   [Round ${round}] 🔄 Rebalance triggered by Treasury Admin`);
      } catch (e) {
        console.log(`   [Round ${round}] 🔄 Rebalance skipped (no new funds in vault)`);
      }

    } else {
      // 20% chance: Just log TVL update
      const currentTvl = await vault.totalAssets();
      console.log(`   [Round ${round}] 📊 TVL Check: ${ethers.formatEther(currentTvl)} tokens`);
    }

    // Wait 5-12 seconds between actions
    const waitTime = randomBetween(5, 12);
    console.log(`   ⏳ Next action in ${waitTime}s...\n`);
    await sleep(waitTime * 1000);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
