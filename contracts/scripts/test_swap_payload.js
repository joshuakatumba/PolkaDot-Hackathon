import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const XCMRouter = await ethers.getContractFactory("XCMRouter");
  const router = await XCMRouter.deploy();
  await router.waitForDeployment();

  const routerAddress = await router.getAddress();
  console.log("XCMRouter deployed to:", routerAddress);

  const assetIn = "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82"; // Example DOT
  const assetOut = "0x9A676e781A523b5d0C0e43731313A708CB607508"; // Example USDC
  const amountIn = ethers.parseEther("100");
  const amountOutMin = ethers.parseEther("95");

  console.log("\nTesting buildSwapOnAssetHub...");
  const payload = await router.buildSwapOnAssetHub(assetIn, assetOut, amountIn, amountOutMin);
  
  console.log("Generated Payload (hex):", payload);
  
  if (payload.startsWith("0x04")) {
    console.log("✅ Version prefix (V4) detected.");
  } else {
    console.log("❌ Missing V4 version prefix.");
  }

  // Basic check for destination (Asset Hub ParaID 1000)
  // _encodeParachainDestination(1000) -> 010100000003e8
  // uint8(1) [Parents], uint8(1) [X1], uint8(0) [Parachain], 1000 (0x3e8) [ParaId]
  // Wait, ParaId is uint32, so 1000 is 0x000003e8.
  // 0x04 [Version] + destination + instructions
  // destination = 010100000003e8
  
  const expectedDest = "010100000003e8";
  if (payload.includes(expectedDest)) {
    console.log("✅ Destination (Asset Hub 1000) detected in payload.");
  } else {
    console.log("❌ Destination not found correctly.");
  }

  console.log("\nPayload analysis complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
