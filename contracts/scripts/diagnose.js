import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const vaultAddr = "0x5081a39b8A5f0E35a8D959395a630b68B74Dd30f";
  const code = await ethers.provider.getCode(vaultAddr);
  console.log(`Vault Code Length: ${code.length}`);

  if (code === "0x") {
    console.log("!!! NO CODE AT VAULT ADDRESS !!!");
    return;
  }

  const vault = await ethers.getContractAt("AutoTreasury", vaultAddr);
  try {
    const owner = await vault.owner();
    console.log(`Vault Owner: ${owner}`);
    
    // Check asset 0 (DOT)
    const dotAddr = "0xB0D4afd8879eD9F52b28595d31B441D079B2Ca07";
    const supported = await vault.supportedAssets(dotAddr);
    console.log(`DOT Supported: ${supported}`);
    
    const count = await vault.strategyCount();
    console.log(`Strategy Count: ${count}`);
  } catch (e) {
    console.log("Error calling vault:", e.message);
  }
}

main().catch(console.error);
