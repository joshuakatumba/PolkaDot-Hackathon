import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 4) {
    console.log("Usage: npx hardhat run scripts/get_swap_payload.js --network <network> <assetIn> <assetOut> <amountIn> <amountOutMin>");
    console.log("\nExample:");
    console.log("npx hardhat run scripts/get_swap_payload.js 0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82 0x9A676e781A523b5d0C0e43731313A708CB607508 100 95");
    return;
  }

  const [assetIn, assetOut, amountInStr, amountOutMinStr] = args;

  const XCMRouter = await ethers.getContractFactory("XCMRouter");
  const router = await XCMRouter.deploy();
  await router.waitForDeployment();

  const amountIn = ethers.parseEther(amountInStr);
  const amountOutMin = ethers.parseEther(amountOutMinStr);

  const payload = await router.buildSwapOnAssetHub(assetIn, assetOut, amountIn, amountOutMin);
  
  console.log("\n════════════════════════════════════════════════════════════════════════════════");
  console.log("  XCM SWAP PAYLOAD GENERATED");
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log(`  Asset In:      ${assetIn}`);
  console.log(`  Asset Out:     ${assetOut}`);
  console.log(`  Amount In:     ${amountInStr} tokens`);
  console.log(`  Min Out:       ${amountOutMinStr} tokens`);
  console.log("────────────────────────────────────────────────────────────────────────────────");
  console.log(`  Payload (hex): ${payload}`);
  console.log("════════════════════════════════════════════════════════════════════════════════\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
