// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers, upgrades } = require("hardhat");

async function main() {
  const _multisigwallet = await ethers.deployContract(
    "DimentMultiSignatureWallet",
    [
      [
        "0xEb098A67D7c46cA48c701cd09d6A3A37b1BA0717",
        "0x5D3C96bF7eCf9bDB75F18BEF5f4a7AEF351543Ea",
        "0xD5aE52e39750c52c94A725D7b7f717239d964AF5",
      ],
      2,
    ]
  );

  const multiSigAddress = await _multisigwallet.getAddress();

  await _multisigwallet.waitForDeployment();
  console.log("MultiSig deployed to:", multiSigAddress);

  const _timelock = await ethers.deployContract("DimentTimelockController", [
    172800,
    [multiSigAddress],
    [
      "0xEb098A67D7c46cA48c701cd09d6A3A37b1BA0717",
      "0x5D3C96bF7eCf9bDB75F18BEF5f4a7AEF351543Ea",
      "0xD5aE52e39750c52c94A725D7b7f717239d964AF5",
    ],
    multiSigAddress,
  ]);

  await _timelock.waitForDeployment();
  console.log("TimeLock deployed to:", await _timelock.getAddress());

  const dimentDollar = await ethers.getContractFactory("DimentDollar");
  const _diment = await upgrades.deployProxy(dimentDollar, [
    "Diment Dollar",
    "DD",
    6,
  ]);
  await _diment.waitForDeployment();

  console.log("Diment Dollar deployed to:", await _diment.getAddress());

  const _dimentStake = await ethers.deployContract("DimentDollarStake", [
    await _diment.getAddress(),
    "0xA7b82A27721BF6271596F23A1540915Cd264234F",
    1000000000,
  ]);

  await _dimentStake.waitForDeployment();
  console.log("Diment Stake deployed to:", await _dimentStake.getAddress());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
