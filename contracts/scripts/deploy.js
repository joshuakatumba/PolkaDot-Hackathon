import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("No deployer account found. Did you set PRIVATE_KEY in your .env file?");
  }
  const [deployer] = signers;
  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  const txOptions = { gasLimit: 5000000, gasPrice: 1000000000 }; // Legacy tx for Westend Hub

  // Helper to manually deploy avoiding ethers v6 waitForDeployment issues on Westend
  async function manualDeploy(contractName, args = []) {
    const factory = await ethers.getContractFactory(contractName);
    const tx = await factory.getDeployTransaction(...args, txOptions);
    const sentTx = await deployer.sendTransaction(tx);
    console.log(`     Tx Hash: ${sentTx.hash}`);
    await sentTx.wait();
    
    // Calculate address manually assuming contractAddress might be missing from receipt
    const address = ethers.getCreateAddress({ from: deployer.address, nonce: sentTx.nonce });
    return factory.attach(address);
  }

  // 1. Deploy Mock Tokens (for local testing)
  console.log("\n1. Deploying Mock Tokens...");
  const mockDOT = await manualDeploy("MockERC20", ["Mock DOT", "DOT"]);
  const mockUSDC = await manualDeploy("MockERC20", ["Mock USDC", "USDC"]);
  const mockDOTAddress = await mockDOT.getAddress();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("   Mock DOT:", mockDOTAddress);
  console.log("   Mock USDC:", mockUSDCAddress);

  // 2. Deploy XCMRouter
  console.log("\n2. Deploying XCMRouter...");
  const xcmRouter = await manualDeploy("XCMRouter");
  const xcmRouterAddress = await xcmRouter.getAddress();
  console.log("   XCMRouter:", xcmRouterAddress);

  // 2.1 Deploy Mock Staking Precompile if on local network
  console.log("\n2.1 Deploying Mock Staking Precompile...");
  const mockStaking = await manualDeploy("MockStakingPrecompile");
  const mockStakingAddress = await mockStaking.getAddress();
  console.log("   MockStakingPrecompile:", mockStakingAddress);
  
  // Link Mock Staking to Router
  await (await xcmRouter.setPrecompileAddresses(
    "0x00000000000000000000000000000000000a0000", // Keep default XCM
    mockStakingAddress,
    txOptions
  )).wait();
  console.log("   Linked MockStaking -> XCMRouter");

  // 3. Deploy AutoTreasury
  console.log("\n3. Deploying AutoTreasury...");
  const treasury = await manualDeploy("AutoTreasury", [xcmRouterAddress]);
  const treasuryAddress = await treasury.getAddress();
  console.log("   AutoTreasury:", treasuryAddress);

  // 4. Link XCMRouter to Treasury
  console.log("\n4. Linking XCMRouter -> Treasury...");
  const tx1 = await xcmRouter.setTreasury(treasuryAddress, txOptions);
  await tx1.wait();
  console.log("   Done.");

  // 5. Deploy NativeStakingStrategy (Track 2 - PVM)
  console.log("\n5. Deploying NativeStakingStrategy...");
  const nativeStaking = await manualDeploy("NativeStakingStrategy", [xcmRouterAddress]);
  const nativeStakingAddress = await nativeStaking.getAddress();
  console.log("   NativeStakingStrategy:", nativeStakingAddress);

  // 6. Deploy AssetHubLendingStrategy
  console.log("\n6. Deploying AssetHubLendingStrategy...");
  const assetHubLending = await manualDeploy("AssetHubLendingStrategy", [xcmRouterAddress, mockUSDCAddress]);
  const assetHubLendingAddress = await assetHubLending.getAddress();
  console.log("   AssetHubLendingStrategy:", assetHubLendingAddress);

  // 7. Configure Treasury (Assets and Strategies)
  console.log("\n7. Configuring Treasury...");
  await (await treasury.addAsset(mockDOTAddress, txOptions)).wait();
  await (await treasury.addAsset(mockUSDCAddress, txOptions)).wait();
  await (await treasury.addStrategy(nativeStakingAddress, txOptions)).wait();
  await (await treasury.addStrategy(assetHubLendingAddress, txOptions)).wait();
  console.log("   Done.");

  // Summary
  console.log("\n═══════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════");
  console.log("  XCMRouter:               ", xcmRouterAddress);
  console.log("  AutoTreasury:            ", treasuryAddress);
  console.log("  NativeStakingStrategy:   ", nativeStakingAddress);
  console.log("  AssetHubLendingStrategy: ", assetHubLendingAddress);
  console.log("  Mock DOT:                ", mockDOTAddress);
  console.log("  Mock USDC:               ", mockUSDCAddress);
  console.log("═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
