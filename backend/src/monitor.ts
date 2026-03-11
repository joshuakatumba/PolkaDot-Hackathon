import { ethers } from "ethers";
import AutoTreasuryABI from "./abi/AutoTreasury.json";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const VAULT_ADDRESS = process.env.VAULT_ADDRESS || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

async function monitorYield() {
  if (!PRIVATE_KEY) {
    console.error("No private key provided for monitor. Check .env file.");
    return;
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const vault = new ethers.Contract(VAULT_ADDRESS, AutoTreasuryABI.abi, wallet);

  console.log(`Starting yield monitor on ${RPC_URL}...`);
  console.log(`Monitoring Vault: ${VAULT_ADDRESS}`);

  const checkAndRebalance = async () => {
    try {
      console.log(`[${new Date().toLocaleTimeString()}] Checking vault state...`);
      
      const totalAssets = await vault.totalAssets();
      const strategyCount = await vault.strategyCount();
      
      console.log(`   TVL: ${ethers.formatEther(totalAssets)}`);
      console.log(`   Strategies: ${strategyCount}`);

      // In a real scenario, we'd fetch external yield data from an Oracle or Protocol API
      // For this refined dev state, we trigger rebalance if assets > 0 and it hasn't been done recently
      // or simply based on a simulated "favorable" yield condition.
      const shouldRebalance = totalAssets > 0n; 

      if (shouldRebalance) {
        console.log("Conditions met. Triggering real rebalance on-chain...");
        const tx = await vault.rebalance({ gasLimit: 1000000 });
        console.log(`   Rebalance TX Sent: ${tx.hash}`);
        await tx.wait();
        console.log("   Rebalance Finalized.");
      } else {
        console.log("   No rebalance needed at this time.");
      }
    } catch (error) {
      console.error("Monitor error:", (error as any).message || error);
    }
  };

  // Initial check
  await checkAndRebalance();

  // Interval check every 5 minutes for dev/testing purposes
  setInterval(checkAndRebalance, 5 * 60 * 1000);
}

monitorYield().catch(err => console.error("Critical Monitor Failure:", err));
