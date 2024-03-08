const { expect } = require("chai");
const { Big } = require("big.js");
const hre = require("hardhat");

describe("DimentDollar", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  let _mintAmount = hre.ethers.parseUnits("1000000", 18);
  let _multisendAmount = hre.ethers.parseUnits("500000", 18);

  let _totalSupply = Big(0);
  let _contractProxy = null;
  let _contractMultiSig = null;
  let _contractTimeLock = null;
  let _contractTimeLockAddress = null;

  let owner = null;
  let addr1 = null;
  let addr2 = null;
  let addr3 = null;
  let addr4 = null;

  before(async () => {
    [owner, addr1, addr2, addr3, addr4] = await hre.ethers.getSigners();
    const DimentDollar = await hre.ethers.getContractFactory("DimentDollar");
    _contractProxy = await hre.upgrades.deployProxy(DimentDollar, [
      "Diment Dollar",
      "DD",
      6,
    ]);

    _contractMultiSig = await hre.ethers.deployContract(
      "DimentMultiSignatureWallet",
      [[owner, addr1, addr2, addr3, addr4], 2]
    );

    _multiSigAddress = await _contractMultiSig.getAddress();

    const TimelockController = await hre.ethers.getContractFactory(
      "DimentTimelockController"
    );

    _contractTimeLock = await TimelockController.deploy(
      10,
      [addr1, addr2, addr3],
      [addr1, addr2, addr3],
      _multiSigAddress
    );

    _contractTimeLockAddress = await _contractTimeLock.getAddress();
  });

  describe("Deployment", function () {
    it("Should set the name DimentDollar", async function () {
      expect(await _contractProxy.name()).to.equal("Diment Dollar");
    });

    it("Should set the symbol ZDD", async function () {
      expect(await _contractProxy.symbol()).to.equal("DD");
    });

    it("Should set the 18 decimals", async function () {
      expect(await _contractProxy.decimals()).to.equal(6);
    });

    it("Should set the right owner", async function () {
      expect(await _contractProxy.owner()).to.equal(owner.address);
    });

    it("Total Supply is Zero", async function () {
      expect(await _contractProxy.totalSupply()).to.equal("0");
    });

    it("Permit nonces is Zero", async function () {
      expect(await _contractProxy.nonces(owner.address)).to.equal("0");
      expect(await _contractProxy.nonces(addr1.address)).to.equal("0");
    });

    it("Not Blacklisted", async function () {
      expect(await _contractProxy.isBlacklisted(addr1.address)).to.equal(false);
      expect(await _contractProxy.isBlacklisted(addr2.address)).to.equal(false);
    });

    it("Zero Balance", async function () {
      expect(await _contractProxy.balanceOf(owner.address)).to.equal("0");
      expect(await _contractProxy.balanceOf(addr1.address)).to.equal("0");
    });

    it("Zero Allowance", async function () {
      expect(
        await _contractProxy.allowance(owner.address, addr1.address)
      ).to.equal("0");
      expect(
        await _contractProxy.allowance(addr1.address, addr2.address)
      ).to.equal("0");
    });
  });

  describe("Owner", function () {
    it("Can chage owner to TimeLock Contract", async function () {
      await _contractProxy.transferOwnership(_contractTimeLockAddress);
      expect(await _contractProxy.owner()).to.equal(_contractTimeLockAddress);
    });
  });

  describe("Mint ", async function () {
    it("Min 1m tokens to owner via multi signature", async function () {
      // address target,
      // uint256 value,
      // bytes calldata data,
      // bytes32 predecessor,
      // bytes32 salt,
      // uint256 delay

      mintTransactionData = await _contractProxy.interface.encodeFunctionData(
        "mint",
        [addr1.address, _mintAmount]
      );

      timeLockTransactionData =
        await _contractTimeLock.interface.encodeFunctionData("schedule", [
          _contractTimeLockAddress,
          0,
          mintTransactionData,
          [addr1.address, addr2.address, addr3.address],
          "SALT",
          11,
        ]);

      console.log(mintTransactionData);
      console.log(timeLockTransactionData);

      try {
        await _contractMultiSig.submitTransaction(
          _contractTimeLockAddress,
          0,
          timeLockTransactionData
        );
        transactionCount += 1;
        expect(true).to.equal(true);
      } catch (err) {
        console.log(err);
        expect(false).to.equal(true);
      }
    });

    // it("Timelock transaction list updated", async function () {
    //   mintTransactionData = await _contractProxy.interface.encodeFunctionData(
    //     "mint",
    //     [addr1, _mintAmount]
    //   );
    //   // address target,
    //   // uint256 value,
    //   // bytes calldata data,
    //   // bytes32 predecessor,
    //   // bytes32 salt
    //   const id = await _contractTimeLock.hashOperation(
    //     _contractProxy,
    //     0,
    //     mintTransactionData,
    //     addr1,
    //     addr1
    //   );
    //   console.log(id);
    // });

    // it("Total Supply is Updated", async function () {
    //   const amount = await _contractProxy.totalSupply();
    //   expect(Big(amount).eq(_totalSupply)).to.equal(true);
    // });
  });
});
