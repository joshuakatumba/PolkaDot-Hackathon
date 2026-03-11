import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("AutoTreasury", function () {
  let owner, user1, user2;
  let treasury, xcmRouter, dotStaking, lendingStrategy;
  let mockDOT, mockPINK, mockDED;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockDOT = await MockERC20.deploy("Mock DOT", "DOT");
    mockPINK = await MockERC20.deploy("Mock PINK", "PINK");
    mockDED = await MockERC20.deploy("Mock DED", "DED");

    // Deploy XCMRouter
    const XCMRouter = await ethers.getContractFactory("XCMRouter");
    xcmRouter = await XCMRouter.deploy();

    // Deploy AutoTreasury
    const AutoTreasury = await ethers.getContractFactory("AutoTreasury");
    treasury = await AutoTreasury.deploy(await xcmRouter.getAddress());

    // Link router to treasury
    await xcmRouter.setTreasury(await treasury.getAddress());

    // Deploy strategies
    const DOTStaking = await ethers.getContractFactory("DOTStakingStrategy");
    dotStaking = await DOTStaking.deploy();

    const Lending = await ethers.getContractFactory("LendingStrategy");
    lendingStrategy = await Lending.deploy();

    // Setup: add assets and strategies
    await treasury.addAsset(await mockDOT.getAddress());
    await treasury.addAsset(await mockPINK.getAddress());
    await treasury.addAsset(await mockDED.getAddress());
    await treasury.addStrategy(dotStaking.getAddress());
    await treasury.addStrategy(lendingStrategy.getAddress());

    // Mint tokens to users
    const mintAmount = ethers.parseEther("10000");
    await mockDOT.mint(user1.address, mintAmount);
    await mockDOT.mint(user2.address, mintAmount);
    await mockPINK.mint(user1.address, mintAmount);
    await mockDED.mint(user2.address, mintAmount);
  });

  // ─────────────────────────────────────
  //  Deposit Tests
  // ─────────────────────────────────────

  describe("Deposit", function () {
    it("should accept a deposit and mint shares 1:1 for first depositor", async function () {
      const amount = ethers.parseEther("1000");
      await mockDOT.connect(user1).approve(await treasury.getAddress(), amount);
      await treasury.connect(user1).deposit(await mockDOT.getAddress(), amount);

      expect(await treasury.shares(user1.address)).to.equal(amount);
      expect(await treasury.totalShares()).to.equal(amount);
      expect(await treasury.totalDeposited(await mockDOT.getAddress())).to.equal(amount);
    });

    it("should mint proportional shares for second depositor", async function () {
      const amount1 = ethers.parseEther("1000");
      const amount2 = ethers.parseEther("500");

      await mockDOT.connect(user1).approve(await treasury.getAddress(), amount1);
      await treasury.connect(user1).deposit(await mockDOT.getAddress(), amount1);

      await mockDOT.connect(user2).approve(await treasury.getAddress(), amount2);
      await treasury.connect(user2).deposit(await mockDOT.getAddress(), amount2);

      expect(await treasury.shares(user2.address)).to.equal(amount2);
      expect(await treasury.totalShares()).to.equal(amount1 + amount2);
    });

    it("should reject unsupported assets", async function () {
      const FakeToken = await ethers.getContractFactory("MockERC20");
      const fakeToken = await FakeToken.deploy("Fake", "FAKE");

      await expect(
        treasury.connect(user1).deposit(await fakeToken.getAddress(), 100)
      ).to.be.revertedWith("AutoTreasury: unsupported asset");
    });

    it("should reject zero amount deposit", async function () {
      await expect(
        treasury.connect(user1).deposit(await mockDOT.getAddress(), 0)
      ).to.be.revertedWith("AutoTreasury: zero amount");
    });
  });

  // ─────────────────────────────────────
  //  Withdraw Tests
  // ─────────────────────────────────────

  describe("Withdraw", function () {
    it("should burn shares and return proportional assets", async function () {
      const amount = ethers.parseEther("1000");
      await mockDOT.connect(user1).approve(await treasury.getAddress(), amount);
      await treasury.connect(user1).deposit(await mockDOT.getAddress(), amount);

      const balBefore = await mockDOT.balanceOf(user1.address);
      await treasury.connect(user1).withdraw(amount);
      const balAfter = await mockDOT.balanceOf(user1.address);

      expect(balAfter - balBefore).to.equal(amount);
      expect(await treasury.shares(user1.address)).to.equal(0);
      expect(await treasury.totalShares()).to.equal(0);
    });

    it("should reject withdraw with zero shares", async function () {
      await expect(
        treasury.connect(user1).withdraw(0)
      ).to.be.revertedWith("AutoTreasury: zero shares");
    });

    it("should reject withdraw exceeding share balance", async function () {
      const amount = ethers.parseEther("1000");
      await mockDOT.connect(user1).approve(await treasury.getAddress(), amount);
      await treasury.connect(user1).deposit(await mockDOT.getAddress(), amount);

      await expect(
        treasury.connect(user1).withdraw(ethers.parseEther("2000"))
      ).to.be.revertedWith("AutoTreasury: insufficient shares");
    });
  });

  // ─────────────────────────────────────
  //  Admin Tests
  // ─────────────────────────────────────

  describe("Admin", function () {
    it("should reject non-owner adding assets", async function () {
      const FakeToken = await ethers.getContractFactory("MockERC20");
      const fakeToken = await FakeToken.deploy("Fake", "FAKE");

      await expect(
        treasury.connect(user1).addAsset(await fakeToken.getAddress())
      ).to.be.revertedWith("AutoTreasury: not owner");
    });

    it("should reject duplicate asset", async function () {
      await expect(
        treasury.addAsset(await mockDOT.getAddress())
      ).to.be.revertedWith("AutoTreasury: already supported");
    });

    it("should remove a strategy", async function () {
      await treasury.removeStrategy(await lendingStrategy.getAddress());
      expect(await treasury.strategyCount()).to.equal(1);
    });
  });

  // ─────────────────────────────────────
  //  View Helpers
  // ─────────────────────────────────────

  describe("View Helpers", function () {
    it("should return correct totalAssets", async function () {
      const amount = ethers.parseEther("1000");
      await mockDOT.connect(user1).approve(await treasury.getAddress(), amount);
      await treasury.connect(user1).deposit(await mockDOT.getAddress(), amount);

      expect(await treasury.totalAssets()).to.equal(amount);
    });

    it("should return share price of 1e18 when no shares", async function () {
      expect(await treasury.sharePrice()).to.equal(ethers.parseEther("1"));
    });

    it("should return correct asset and strategy counts", async function () {
      expect(await treasury.assetCount()).to.equal(3);
      expect(await treasury.strategyCount()).to.equal(2);
    });
  });

  // ─────────────────────────────────────
  //  XCM Router Tests
  // ─────────────────────────────────────

  describe("XCM Router", function () {
    it("should build a transfer payload", async function () {
      const payload = await xcmRouter.buildTransferToAssetHub(
        await mockDOT.getAddress(),
        ethers.parseEther("100")
      );

      expect(payload.length).to.be.greaterThan(0);
      expect(payload.slice(0, 4)).to.equal("0x04");
    });

    it("should build a swap payload", async function () {
      const payload = await xcmRouter.buildSwapPayload(
        await mockDOT.getAddress(),
        await mockPINK.getAddress(),
        ethers.parseEther("50")
      );

      expect(payload.length).to.be.greaterThan(0);
    });
  });

  // ─────────────────────────────────────
  //  Strategy Tests
  // ─────────────────────────────────────

  describe("Yield Strategies", function () {
    it("DOTStaking should accrue simulated yield", async function () {
      await dotStaking.invest(ethers.parseEther("1000"));
      const yieldAmount = await dotStaking.harvestYield.staticCall();
      // 50 bps of 1000 = 5
      expect(yieldAmount).to.equal(ethers.parseEther("5"));
    });

    it("LendingStrategy should accrue simulated yield", async function () {
      await lendingStrategy.invest(ethers.parseEther("1000"));
      const yieldAmount = await lendingStrategy.harvestYield.staticCall();
      // 30 bps of 1000 = 3
      expect(yieldAmount).to.equal(ethers.parseEther("3"));
    });

    it("should report correct totalValue after investment and harvest", async function () {
      await dotStaking.invest(ethers.parseEther("1000"));
      await dotStaking.harvestYield();
      expect(await dotStaking.totalValue()).to.equal(ethers.parseEther("1005"));
    });
  });
});
