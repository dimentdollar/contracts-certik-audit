// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers, upgrades } = require('hardhat');

const OLDPROXYADRESS = '';

async function main() {
  const dimentDollar = await ethers.getContractFactory('DimentDollarV2');
  const _dimentV2 = await upgrades.upgradeProxy(OLDPROXYADRESS, dimentDollar);
  await _dimentV2.waitForDeployment();
  console.log('Diment Dollar new address to:', await _dimentV2.getAddress());
  console.log('Diment Dollar upgraded');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
