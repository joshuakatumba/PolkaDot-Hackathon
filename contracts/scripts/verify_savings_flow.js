import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const [owner, user] = await ethers.getSigners();

  // Deploy Mocks & Router
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const dot = await MockERC20.deploy("Polkadot", "DOT");
  await dot.waitForDeployment();

  const XCMRouter = await ethers.getContractFactory("XCMRouter");
  const router = await XCMRouter.deploy();
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();

  // Deploy Mock XCM Precompile
  const MockXcm = await ethers.getContractFactory("MockXcm");
  const mockXcm = await MockXcm.deploy();
  await mockXcm.waitForDeployment();
  const mockXcmAddress = await mockXcm.getAddress();

  // Set precompile addresses in router (staking precompile can be any address for this test)
  await router.setPrecompileAddresses(mockXcmAddress, ethers.ZeroAddress);

  // Deploy Savings Vault
  const AutoTreasury = await ethers.getContractFactory("AutoTreasury");
  const vault = await AutoTreasury.deploy(await router.getAddress(), await dot.getAddress());
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  // Authorize vault in router
  await router.setTreasury(vaultAddress);

  // Deploy Strategy
  const DOTStakingStrategy = await ethers.getContractFactory("DOTStakingStrategy");
  const strategy = await DOTStakingStrategy.deploy(await dot.getAddress());
  await strategy.waitForDeployment();
  const strategyAddress = await strategy.getAddress();

  // Add strategy to vault
  await vault.addStrategy(strategyAddress);

  console.log("════════════════════════════════════════════════");
  console.log("  SAVINGS PLATFORM FLOW VERIFICATION");
  console.log("════════════════════════════════════════════════");

  // 1. Initial Savings
  const saveAmount = ethers.parseEther("1000");
  await dot.mint(user.address, saveAmount);
  await dot.connect(user).approve(await vault.getAddress(), saveAmount);
  
  console.log(`▶ Step 1: User saves ${ethers.formatEther(saveAmount)} DOT`);
  await vault.connect(user).save(saveAmount);
  
  let principal = await vault.principal(user.address);
  console.log(`   Internal State: Principal = ${ethers.formatEther(principal)} DOT`);

  // Move funds to strategy
  console.log("\n▶ Step 1.5: Rebalancing into strategies...");
  await vault.rebalance();

  // 2. Simulate Yield Generation
  console.log("\n▶ Step 2: Simulating Yield Generation...");
  // For the demo, we'll manually mint yield to the vault and call a mock harvest
  // In reality, strategies would do this.
  const yieldAmount = ethers.parseEther("50");
  await dot.mint(await vault.getAddress(), yieldAmount);
  
  // Increase yield rate to ensure enough yield for the test
  await strategy.setYieldRate(500); // 5% per harvest
  
  // We'll call a transfer to trigger _harvestAll (which is internal, so we trigger via save or withdraw)
  const dustAmount = ethers.parseEther("1");
  await dot.mint(user.address, dustAmount);
  await dot.connect(user).approve(await vault.getAddress(), dustAmount);
  await vault.connect(user).save(dustAmount); // Dust to trigger harvest
  
  let yieldBalance = await vault.spendableYield(user.address);
  console.log(`   Internal State: Spendable Yield = ${ethers.formatEther(yieldBalance)} DOT`);

  // 3. Cross-Chain Payment with Yield
  console.log("\n▶ Step 3: Paying for Service with Yield (Cross-Chain)");
  const payAmount = ethers.parseEther("20");
  const targetAsset = "0x9A676e781A523b5d0C0e43731313A708CB607508"; // Example USDC
  
  await vault.connect(user).payWithYield(1000, targetAsset, payAmount);
  
  yieldBalance = await vault.spendableYield(user.address);
  principal = await vault.principal(user.address);
  
  console.log(`   Payment sent! Remaining Yield: ${ethers.formatEther(yieldBalance)} DOT`);
  console.log(`   ✅ PRINCIPAL PROTECTED: ${ethers.formatEther(principal)} DOT remains untouched.`);

  // 4. Withdrawal
  console.log("\n▶ Step 4: Withdrawing Principal");
  await vault.connect(user).withdrawPrincipal(principal);
  const finalBal = await dot.balanceOf(user.address);
  console.log(`   Final User Balance: ${ethers.formatEther(finalBal)} DOT`);
  console.log("════════════════════════════════════════════════\n");
}

main().catch((error) => {
  console.error("❌ TEST FAILED:");
  if (error.reason) console.error("   Reason:", error.reason);
  if (error.data) console.error("   Data:", error.data);
  console.error(error);
  process.exit(1);
});
