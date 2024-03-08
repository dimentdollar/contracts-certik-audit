const { expect } = require("chai");
const { Big } = require("big.js");
const hre = require("hardhat");

const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DimentDollar", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  let _mintAmount = hre.ethers.parseUnits("1000000", 6);
  let _multisendAmount = hre.ethers.parseUnits("500000", 6);

  let _totalSupply = Big(0);
  let _contractProxy = null;
  let _contractMultiSig = null;
  let _contractTimeLock = null;

  let _proxyAddress = null;
  let _multiSigAddress = null;
  let _timeLockAddress = null;

  let owner = null;
  let addr1 = null;
  let addr2 = null;
  let addr3 = null;
  let addr4 = null;

  let transactionCount = 0;
  let transactionData = null;
  let currentTransactionId = 0;
  let timeLockId = 0;

  before(async () => {
    [owner, addr1, addr2, addr3, addr4] = await hre.ethers.getSigners();
    const DimentDollar = await hre.ethers.getContractFactory("DimentDollar");
    _contractProxy = await hre.upgrades.deployProxy(DimentDollar, [
      "Diment Dollar",
      "DD",
      6,
    ]);

    _proxyAddress = await _contractProxy.getAddress();

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
      [_multiSigAddress, addr1, addr2, addr3],
      [_multiSigAddress, addr1, addr2, addr3],
      _multiSigAddress
    );

    _timeLockAddress = await _contractTimeLock.getAddress();
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
      await _contractProxy.transferOwnership(_timeLockAddress);
      expect(await _contractProxy.owner()).to.equal(_timeLockAddress);
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
      let b32Pre = hre.ethers.encodeBytes32String("");
      let b32Salt = hre.ethers.encodeBytes32String("SALT");

      let mintTransactionData =
        await _contractProxy.interface.encodeFunctionData("mint", [
          addr1.address,
          _mintAmount,
        ]);

      let timeLockTransactionData =
        await _contractTimeLock.interface.encodeFunctionData("schedule", [
          _proxyAddress,
          0,
          mintTransactionData,
          b32Pre,
          b32Salt,
          11,
        ]);

      const id = await _contractTimeLock.hashOperation(
        _proxyAddress,
        0,
        mintTransactionData,
        b32Pre,
        b32Salt
      );

      timeLockId = id;
      transactionData = timeLockTransactionData;

      try {
        await _contractMultiSig.submitTransaction(
          _timeLockAddress,
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

    it("MS Transaction list is updated", async () => {
      const result = await _contractMultiSig.getTransactionCount();
      expect(+result.toString()).to.equal(transactionCount);
    });

    it("MS Required approve count transaction data is correct", async () => {
      const result = await _contractMultiSig.getTransaction(
        currentTransactionId
      );

      expect(result.to.toString()).to.equal(_contractTimeLock);
      expect(result.value.toString()).to.equal("0");
      expect(result.data.toString()).to.equal(transactionData);
      expect(result.executed).to.equal("0");
      expect(result.numConfirmations.toString()).to.equal("0");
    });

    it("Transaction will approve with account[1]", async () => {
      try {
        await _contractMultiSig
          .connect(addr1)
          .confirmTransaction(currentTransactionId);
        expect(true).to.equal(true);
      } catch {
        expect(false).to.equal(true);
      }
    });

    it("Required approve count transaction data is correct after x2 confirmation", async () => {
      const result = await _contractMultiSig.getTransaction(
        currentTransactionId
      );

      expect(result.to.toString()).to.equal(_timeLockAddress);
      expect(result.value.toString()).to.equal("0");
      expect(result.data.toString()).to.equal(transactionData);
      expect(result.executed).to.equal("0");
      expect(result.numConfirmations.toString()).to.equal("1");
    });

    it("Transaction will approve with account[0]", async () => {
      try {
        await _contractMultiSig
          .connect(owner)
          .confirmTransaction(currentTransactionId);
        expect(true).to.equal(true);
      } catch {
        expect(false).to.equal(true);
      }
    });

    it("Timelock id is unset", async function () {
      const result = await _contractTimeLock.getOperationState(timeLockId);
      expect(result).to.equal("0");
    });

    it("Transaction will execute from account[3]", async () => {
      try {
        await _contractMultiSig
          .connect(addr2)
          .executeTransaction(currentTransactionId);
        expect(true).to.equal(true);
      } catch (err) {
        expect(false).to.equal(true);
      }
    });

    it("Trnasaction executed", async () => {
      const result = await _contractMultiSig.getTransaction(
        currentTransactionId
      );

      expect(result.to.toString()).to.equal(_timeLockAddress);
      expect(result.value.toString()).to.equal("0");
      expect(result.data.toString()).to.equal(transactionData);
      expect(result.executed).to.equal("1");
      expect(result.numConfirmations.toString()).to.equal("2");
    });

    it("Timelock id is waiting", async function () {
      const result = await _contractTimeLock.getOperationState(timeLockId);
      expect(result).to.equal("1");
    });

    it("After a time Timelock id is now ready", async function () {
      await time.increase(12);
      const result = await _contractTimeLock.getOperationState(timeLockId);
      expect(result).to.equal("2");
    });

    // address target,
    // uint256 value,
    // bytes calldata payload,
    // bytes32 predecessor,
    // bytes32 salt
    it("Timelock execute transaction", async function () {
      let mintTransactionData =
        await _contractProxy.interface.encodeFunctionData("mint", [
          addr1.address,
          _mintAmount,
        ]);

      b32Pre = hre.ethers.encodeBytes32String("");
      b32Salt = hre.ethers.encodeBytes32String("SALT");

      try {
        await _contractTimeLock
          .connect(addr1)
          .execute(_proxyAddress, 0, mintTransactionData, b32Pre, b32Salt);

        expect(true).to.equal(true);
      } catch (error) {
        console.log(error);
        expect(false).to.equal(true);
      }
    });

    it("Timelock id is now done", async function () {
      await time.increase(12);
      const result = await _contractTimeLock.getOperationState(timeLockId);
      _totalSupply = _totalSupply.add(_mintAmount);
      expect(result).to.equal("3");
    });

    it("Total Supply is Zero", async function () {
      expect(await _contractProxy.totalSupply()).to.equal(
        _totalSupply.toString()
      );
    });
  });

  describe("Change Time Lock Time", function () {
    // read old data

    it("Time Lock min time is 10", async function () {
      expect(await _contractTimeLock.getMinDelay()).to.equal(10);
    });

    it("Can chage owner to TimeLock Contract", async function () {
      currentTransactionId += 1;

      // address target,
      // uint256 value,
      // bytes calldata data,
      // bytes32 predecessor,
      // bytes32 salt,
      // uint256 delay
      b32Pre = hre.ethers.encodeBytes32String("");
      b32Salt = hre.ethers.encodeBytes32String("SALT");

      let changeDelayTransactionData =
        await _contractTimeLock.interface.encodeFunctionData("updateDelay", [
          5,
        ]);

      let timeLockTransactionData =
        await _contractTimeLock.interface.encodeFunctionData("schedule", [
          _timeLockAddress,
          0,
          changeDelayTransactionData,
          b32Pre,
          b32Salt,
          12,
        ]);

      const id = await _contractTimeLock.hashOperation(
        _timeLockAddress,
        0,
        changeDelayTransactionData,
        b32Pre,
        b32Salt
      );

      timeLockId = id;
      transactionData = timeLockTransactionData;

      try {
        await _contractMultiSig.submitTransaction(
          _timeLockAddress,
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

    it("Transaction will approve with account[1] and account[2]", async () => {
      try {
        await _contractMultiSig
          .connect(addr1)
          .confirmTransaction(currentTransactionId);
        await _contractMultiSig
          .connect(addr2)
          .confirmTransaction(currentTransactionId);
        expect(true).to.equal(true);
      } catch {
        expect(false).to.equal(true);
      }
    });

    it("Transaction will execute from account[3]", async () => {
      try {
        await _contractMultiSig
          .connect(addr2)
          .executeTransaction(currentTransactionId);
        expect(true).to.equal(true);
      } catch (err) {
        expect(false).to.equal(true);
      }
    });

    it("Trnasaction executed", async () => {
      const result = await _contractMultiSig.getTransaction(
        currentTransactionId
      );

      expect(result.to.toString()).to.equal(_timeLockAddress);
      expect(result.value.toString()).to.equal("0");
      expect(result.data.toString()).to.equal(transactionData);
      expect(result.executed).to.equal("1");
      expect(result.numConfirmations.toString()).to.equal("2");
    });

    it("Timelock id is waiting", async function () {
      const result = await _contractTimeLock.getOperationState(timeLockId);
      expect(result).to.equal("1");
    });

    it("After a time Timelock id is now ready", async function () {
      await time.increase(12);
      const result = await _contractTimeLock.getOperationState(timeLockId);
      expect(result).to.equal("2");
    });

    // address target,
    // uint256 value,
    // bytes calldata payload,
    // bytes32 predecessor,
    // bytes32 salt
    it("Timelock execute transaction", async function () {
      let changeDelayTransactionData =
        await _contractTimeLock.interface.encodeFunctionData("updateDelay", [
          5,
        ]);

      b32Pre = hre.ethers.encodeBytes32String("");
      b32Salt = hre.ethers.encodeBytes32String("SALT");

      try {
        await _contractTimeLock
          .connect(addr2)
          .execute(
            _timeLockAddress,
            0,
            changeDelayTransactionData,
            b32Pre,
            b32Salt
          );

        expect(true).to.equal(true);
      } catch (error) {
        console.log(error);
        expect(false).to.equal(true);
      }
    });

    it("Time Lock min time is 5", async function () {
      expect(await _contractTimeLock.getMinDelay()).to.equal(5);
    });
  });

  describe("Mint x2", async function () {
    it("Min 1m tokens to owner via multi signature x2", async function () {
      currentTransactionId += 1;
      // address target,
      // uint256 value,
      // bytes calldata data,
      // bytes32 predecessor,
      // bytes32 salt,
      // uint256 delay
      b32Pre = hre.ethers.encodeBytes32String("");
      b32Salt = hre.ethers.encodeBytes32String("SALT SECOND TIME");

      let mintTransactionData =
        await _contractProxy.interface.encodeFunctionData("mint", [
          addr2.address,
          _mintAmount,
        ]);

      let timeLockTransactionData =
        await _contractTimeLock.interface.encodeFunctionData("schedule", [
          _proxyAddress,
          0,
          mintTransactionData,
          b32Pre,
          b32Salt,
          5,
        ]);

      const id = await _contractTimeLock.hashOperation(
        _proxyAddress,
        0,
        mintTransactionData,
        b32Pre,
        b32Salt
      );

      timeLockId = id;
      transactionData = timeLockTransactionData;

      try {
        await _contractMultiSig.submitTransaction(
          _timeLockAddress,
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

    it("MS Transaction list is updated x2", async () => {
      const result = await _contractMultiSig.getTransactionCount();
      expect(+result.toString()).to.equal(transactionCount);
    });

    it("MS Required approve count transaction data is correct x2", async () => {
      const result = await _contractMultiSig.getTransaction(
        currentTransactionId
      );

      expect(result.to.toString()).to.equal(_contractTimeLock);
      expect(result.value.toString()).to.equal("0");
      expect(result.data.toString()).to.equal(transactionData);
      expect(result.executed).to.equal("0");
      expect(result.numConfirmations.toString()).to.equal("0");
    });

    it("Transaction will approve with account[1] x2", async () => {
      try {
        await _contractMultiSig
          .connect(addr1)
          .confirmTransaction(currentTransactionId);
        expect(true).to.equal(true);
      } catch {
        expect(false).to.equal(true);
      }
    });

    it("Required approve count transaction data is correct after x2 confirmation x2", async () => {
      const result = await _contractMultiSig.getTransaction(
        currentTransactionId
      );

      expect(result.to.toString()).to.equal(_timeLockAddress);
      expect(result.value.toString()).to.equal("0");
      expect(result.data.toString()).to.equal(transactionData);
      expect(result.executed).to.equal("0");
      expect(result.numConfirmations.toString()).to.equal("1");
    });

    it("Transaction will approve with account[0] x2", async () => {
      try {
        await _contractMultiSig
          .connect(owner)
          .confirmTransaction(currentTransactionId);
        expect(true).to.equal(true);
      } catch {
        expect(false).to.equal(true);
      }
    });

    it("Timelock id is unset x2", async function () {
      const result = await _contractTimeLock.getOperationState(timeLockId);
      expect(result).to.equal("0");
    });

    it("Transaction will execute from account[3] x2", async () => {
      try {
        await _contractMultiSig
          .connect(addr2)
          .executeTransaction(currentTransactionId);
        expect(true).to.equal(true);
      } catch (err) {
        expect(false).to.equal(true);
      }
    });

    it("Trnasaction executed x2", async () => {
      const result = await _contractMultiSig.getTransaction(
        currentTransactionId
      );

      expect(result.to.toString()).to.equal(_timeLockAddress);
      expect(result.value.toString()).to.equal("0");
      expect(result.data.toString()).to.equal(transactionData);
      expect(result.executed).to.equal("1");
      expect(result.numConfirmations.toString()).to.equal("2");
    });

    it("Timelock id is waiting x2", async function () {
      const result = await _contractTimeLock.getOperationState(timeLockId);
      expect(result).to.equal("1");
    });

    it("After a time Timelock id is now ready x2", async function () {
      await time.increase(12);
      const result = await _contractTimeLock.getOperationState(timeLockId);
      expect(result).to.equal("2");
    });

    // address target,
    // uint256 value,
    // bytes calldata payload,
    // bytes32 predecessor,
    // bytes32 salt
    it("Timelock execute transaction x2", async function () {
      let mintTransactionData =
        await _contractProxy.interface.encodeFunctionData("mint", [
          addr2.address,
          _mintAmount,
        ]);

      let b32Pre = hre.ethers.encodeBytes32String("");
      let b32Salt = hre.ethers.encodeBytes32String("SALT SECOND TIME");

      try {
        await _contractTimeLock
          .connect(addr1)
          .execute(_proxyAddress, 0, mintTransactionData, b32Pre, b32Salt);

        expect(true).to.equal(true);
      } catch (error) {
        console.log(error);
        expect(false).to.equal(true);
      }
    });

    it("Timelock id is now done x2", async function () {
      await time.increase(5);
      const result = await _contractTimeLock.getOperationState(timeLockId);
      _totalSupply = _totalSupply.add(_mintAmount);
      expect(result).to.equal("3");
    });

    it("Total Supply is Zero x2", async function () {
      expect(await _contractProxy.totalSupply()).to.equal(
        _totalSupply.toString()
      );
    });
  });

  describe("Cannot accept transaction under time lock limit", async function () {
    it("Request Min 1m tokens to owner via multi signature", async function () {
      currentTransactionId += 1;
      // address target,
      // uint256 value,
      // bytes calldata data,
      // bytes32 predecessor,
      // bytes32 salt,
      // uint256 delay
      b32Pre = hre.ethers.encodeBytes32String("");
      b32Salt = hre.ethers.encodeBytes32String("SALT TEST");

      let mintTransactionData =
        await _contractProxy.interface.encodeFunctionData("mint", [
          addr2.address,
          _mintAmount,
        ]);

      let timeLockTransactionData =
        await _contractTimeLock.interface.encodeFunctionData("schedule", [
          _proxyAddress,
          0,
          mintTransactionData,
          b32Pre,
          b32Salt,
          4,
        ]);

      const id = await _contractTimeLock.hashOperation(
        _proxyAddress,
        0,
        mintTransactionData,
        b32Pre,
        b32Salt
      );

      timeLockId = id;
      transactionData = timeLockTransactionData;

      try {
        await _contractMultiSig.submitTransaction(
          _timeLockAddress,
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

    it("MS Transaction list is updated x3", async () => {
      const result = await _contractMultiSig.getTransactionCount();
      expect(+result.toString()).to.equal(transactionCount);
    });

    it("MS Required approve count transaction data is correct x3", async () => {
      const result = await _contractMultiSig.getTransaction(
        currentTransactionId
      );

      expect(result.to.toString()).to.equal(_contractTimeLock);
      expect(result.value.toString()).to.equal("0");
      expect(result.data.toString()).to.equal(transactionData);
      expect(result.executed).to.equal("0");
      expect(result.numConfirmations.toString()).to.equal("0");
    });

    it("Transaction will approve with account[1] x3", async () => {
      try {
        await _contractMultiSig
          .connect(addr1)
          .confirmTransaction(currentTransactionId);
        expect(true).to.equal(true);
      } catch {
        expect(false).to.equal(true);
      }
    });

    it("Required approve count transaction data is correct after x2 confirmation x3", async () => {
      const result = await _contractMultiSig.getTransaction(
        currentTransactionId
      );

      expect(result.to.toString()).to.equal(_timeLockAddress);
      expect(result.value.toString()).to.equal("0");
      expect(result.data.toString()).to.equal(transactionData);
      expect(result.executed).to.equal("0");
      expect(result.numConfirmations.toString()).to.equal("1");
    });

    it("Transaction will approve with account[0] x3", async () => {
      try {
        await _contractMultiSig
          .connect(owner)
          .confirmTransaction(currentTransactionId);
        expect(true).to.equal(true);
      } catch (err) {
        console.log(err);
        expect(false).to.equal(true);
      }
    });

    it("Transaction will execute from account[3] x3", async () => {
      try {
        await _contractMultiSig
          .connect(addr2)
          .executeTransaction(currentTransactionId);
        expect(false).to.equal(true);
      } catch (err) {
        expect(true).to.equal(true);
      }
    });

    it("Trnasaction cannot executed", async () => {
      const result = await _contractMultiSig.getTransaction(
        currentTransactionId
      );

      expect(result.to.toString()).to.equal(_timeLockAddress);
      expect(result.value.toString()).to.equal("0");
      expect(result.data.toString()).to.equal(transactionData);
      expect(result.executed).to.equal("0");
      expect(result.numConfirmations.toString()).to.equal("2");
    });

    it("Timelock id is not updated", async function () {
      const result = await _contractTimeLock.getOperationState(timeLockId);
      expect(result).to.equal("0");
    });
  });
});
