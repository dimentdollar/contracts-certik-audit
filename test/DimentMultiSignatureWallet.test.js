const { expect } = require("chai");
const { Big } = require("big.js");
const hre = require("hardhat");

describe("Diment Multi Signature Wallet", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  let _mintAmount = hre.ethers.parseUnits("1000000", 18);
  let _multisendAmount = hre.ethers.parseUnits("500000", 18);

  let _totalSupply = Big(0);
  let _contractProxy = null;

  let owner = null;
  let addr1 = null;
  let addr2 = null;
  let addr3 = null;
  let addr4 = null;
  let addr5 = null;
  let addr6 = null;
  let owners = [owner, addr1, addr2, addr3, addr4];

  let _contractMultiSig = null;
  let transactionData = null;
  let _multiSigAddress = null;
  let requiredOwners = 2;
  let transactionCount = 0;
  let currentTransactionId = 0;

  before(async () => {
    [owner, addr1, addr2, addr3, addr4, addr5, addr6] =
      await hre.ethers.getSigners();
    const DimentDollar = await hre.ethers.getContractFactory("DimentDollar");

    _contractProxy = await hre.upgrades.deployProxy(DimentDollar, [
      "Diment Dollar",
      "DD",
      6,
    ]);

    _contractMultiSig = await hre.ethers.deployContract(
      "DimentMultiSignatureWallet",
      [
        [
          owner.address,
          addr1.address,
          addr2.address,
          addr3.address,
          addr4.address,
        ],
        2,
      ]
    );

    _multiSigAddress = await _contractMultiSig.getAddress();
  });

  describe("Deployment", function () {
    it("Should set the name Diment Dollar", async function () {
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

  describe("Multi Signature Wallet Main Inside Functions", () => {
    it("Transfer Ownership from account[0] to multisigwallet", async () => {
      await _contractProxy.transferOwnership(_multiSigAddress);
      const _newOwner = await _contractProxy.owner();
      expect(_newOwner).to.equal(_multiSigAddress);
    });

    it("Multi Sig wallet required approve count is correct", async () => {
      const result = await _contractMultiSig.numConfirmationsRequired();
      expect(+result.toString()).to.equal(requiredOwners);
    });

    it("Transaction list is empty", async () => {
      const result = await _contractMultiSig.getTransactionCount();
      expect(+result.toString()).to.equal(transactionCount);
    });

    it("Change requirement for approve", async () => {
      requiredOwners = 3;
      transactionData = await _contractMultiSig.interface.encodeFunctionData(
        "changeRequirement",
        [3]
      );

      try {
        await _contractMultiSig.submitTransaction(
          _multiSigAddress,
          0,
          transactionData
        );
        transactionCount += 1;
        expect(true).to.equal(true);
      } catch (err) {
        expect(false).to.equal(true);
      }
    });

    it("Transaction list is updated", async () => {
      const result = await _contractMultiSig.getTransactionCount();
      expect(+result.toString()).to.equal(transactionCount);
    });

    it("Required approve count transaction data is correct", async () => {
      const result = await _contractMultiSig.getTransaction(
        currentTransactionId
      );

      expect(result.to.toString()).to.equal(_multiSigAddress);
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

    it("Required approve count transaction data is correct after x1 confirmation", async () => {
      const result = await _contractMultiSig.getTransaction(
        currentTransactionId
      );

      expect(result.to.toString()).to.equal(_multiSigAddress);
      expect(result.value.toString()).to.equal("0");
      expect(result.data.toString()).to.equal(transactionData);
      expect(result.executed).to.equal("0");
      expect(result.numConfirmations.toString()).to.equal("1");
    });

    it("Transaction will not approve second time with account[1]", async () => {
      try {
        await _contractMultiSig
          .connect(addr1)
          .confirmTransaction(currentTransactionId, {
            from: accounts[1],
          });
        expect(false).to.equal(true);
      } catch (err) {
        expect(true).to.equal(true);
      }
    });

    it("Transaction cannot execute with 1 confirmation", async () => {
      try {
        await _contractMultiSig
          .connect(addr2)
          .executeTransaction(currentTransactionId);
        expect(false).to.equal(true);
      } catch {
        expect(true).to.equal(true);
      }
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

    it("Required approve count transaction data is correct after x2 confirmation", async () => {
      const result = await _contractMultiSig.getTransaction(
        currentTransactionId
      );

      expect(result.to.toString()).to.equal(_multiSigAddress);
      expect(result.value.toString()).to.equal("0");
      expect(result.data.toString()).to.equal(transactionData);
      expect(result.executed).to.equal("0");
      expect(result.numConfirmations.toString()).to.equal("2");
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

      expect(result.to.toString()).to.equal(_multiSigAddress);
      expect(result.value.toString()).to.equal("0");
      expect(result.data.toString()).to.equal(transactionData);
      expect(result.executed).to.equal("1");
      expect(result.numConfirmations.toString()).to.equal("2");
    });

    it("Transaction cannot execute again", async () => {
      try {
        await _contractMultiSig
          .connect(addr2)
          .executeTransaction(currentTransactionId);
        expect(false).to.equal(true);
      } catch (err) {
        expect(true).to.equal(true);
      }
    });

    it("Multi Sig wallet required approve count is correct", async () => {
      const result = await _contractMultiSig.numConfirmationsRequired();
      expect(+result.toString()).to.equal(requiredOwners);
    });

    it("Remove addr4 from owners", async () => {
      //remove last
      owners.pop();

      transactionData = await _contractMultiSig.interface.encodeFunctionData(
        "removeOwner",
        [addr4.address]
      );

      try {
        await _contractMultiSig.submitTransaction(
          _multiSigAddress,
          0,
          transactionData
        );
        transactionCount += 1;
        currentTransactionId += 1;
        expect(true).to.equal(true);
      } catch (err) {
        expect(false).to.equal(true);
      }
    });

    it("Transaction list is updated", async () => {
      const result = await _contractMultiSig.getTransactionCount();
      expect(+result.toString()).to.equal(transactionCount);
    });

    it("Owner remove transaction data is correct after x2 confirmation", async () => {
      const result = await _contractMultiSig.getTransaction(
        currentTransactionId
      );

      expect(result.to.toString()).to.equal(_multiSigAddress);
      expect(result.value.toString()).to.equal("0");
      expect(result.data.toString()).to.equal(transactionData);
      expect(result.executed).to.equal("0");
      expect(result.numConfirmations.toString()).to.equal("0");
    });

    it("Transaction cannot execute with 1 confirmation", async () => {
      try {
        await _contractMultiSig
          .connect(owner)
          .executeTransaction(currentTransactionId);
        expect(false).to.equal(true);
      } catch (err) {
        expect(true).to.equal(true);
      }
    });

    it("Transaction will approve with addr2", async () => {
      try {
        await _contractMultiSig
          .connect(addr2)
          .confirmTransaction(currentTransactionId);
        expect(true).to.equal(true);
      } catch {
        expect(false).to.equal(true);
      }
    });

    it("Transaction will approve with addr3", async () => {
      try {
        await _contractMultiSig
          .connect(addr3)
          .confirmTransaction(currentTransactionId);
        expect(true).to.equal(true);
      } catch {
        expect(false).to.equal(true);
      }
    });

    it("Transaction will approve with addr1", async () => {
      try {
        await _contractMultiSig
          .connect(addr1)
          .confirmTransaction(currentTransactionId);
        expect(true).to.equal(true);
      } catch {
        expect(false).to.equal(true);
      }
    });

    it("Transaction will approve with addr3", async () => {
      try {
        await _contractMultiSig
          .connect(addr3)
          .revokeConfirmation(currentTransactionId);
        expect(true).to.equal(true);
      } catch (err) {
        console.log(err);
        expect(false).to.equal(true);
      }
    });

    it("Transaction revoke and confrim amount is correct", async () => {
      const result = await _contractMultiSig.getTransaction(
        currentTransactionId
      );

      expect(result[4].toString()).to.equal("2");
    });

    it("Transaction cannot execute with under approved amount", async () => {
      try {
        await _contractMultiSig
          .connect(addr3)
          .executeTransaction(currentTransactionId);
        expect(false).to.equal(true);
      } catch (err) {
        expect(true).to.equal(true);
      }
    });

    it("Transaction will approve with owner", async () => {
      try {
        await _contractMultiSig
          .connect(owner)
          .confirmTransaction(currentTransactionId);
        expect(true).to.equal(true);
      } catch {
        expect(false).to.equal(true);
      }
    });
    it("Transaction will be execute with approved amount", async () => {
      try {
        await _contractMultiSig
          .connect(addr4)
          .executeTransaction(currentTransactionId);
        expect(true).to.equal(true);
      } catch (err) {
        expect(false).to.equal(true);
      }
    });

    // it('Multi Sig wallet owner count is correct', async () => {
    //   const result = await _contractMultiSig.getOwners();
    //   assert(result.length == owners.length, 'owner count is correct');
    // });

    // it('Multi Sig wallet owners are correct', async () => {
    //   const result = await _contractMultiSig.getOwners();
    //   assert(result.toString() == owners.toString(), 'arr are not same');
    // });

    it("Replace addr3 with addr5", async () => {
      owners.pop();
      owners.push(addr5.address);

      transactionData = await _contractMultiSig.interface.encodeFunctionData(
        "replaceOwner",
        [addr3.address, addr5.address]
      );

      try {
        await _contractMultiSig.submitTransaction(
          _multiSigAddress,
          0,
          transactionData
        );
        transactionCount += 1;
        currentTransactionId += 1;
        expect(true).to.equal(true);
      } catch (err) {
        expect(false).to.equal(true);
      }
    });

    it("Transaction list is updated", async () => {
      const result = await _contractMultiSig.getTransactionCount();
      expect(+result.toString()).to.equal(transactionCount);
    });

    it("Transaction will approve with x3", async () => {
      try {
        await _contractMultiSig
          .connect(addr1)
          .confirmTransaction(currentTransactionId);
        await _contractMultiSig
          .connect(addr2)
          .confirmTransaction(currentTransactionId);
        await _contractMultiSig
          .connect(addr3)
          .confirmTransaction(currentTransactionId);
        expect(true).to.equal(true);
      } catch {
        expect(false).to.equal(true);
      }
    });

    it("Transaction execute", async () => {
      try {
        await _contractMultiSig
          .connect(addr3)
          .executeTransaction(currentTransactionId);
        expect(true).to.equal(true);
      } catch {
        expect(false).to.equal(true);
      }
    });

    it("addr5 is replaced buy addr3", async () => {
      const result = await _contractMultiSig.isOwner(addr5.address);
      expect(result).to.equal(true);
    });

    it("addr6 is not owner", async () => {
      const result = await _contractMultiSig.isOwner(addr6.address);
      expect(result).to.equal(false);
    });

    // it('Multi Sig wallet owner count is correct', async () => {
    //   const result = await _contractMultiSig.getOwners();
    //   assert(result.length == owners.length, 'owner count is correct');
    // });

    // it('Multi Sig wallet owners are correct account[9] replaced account[4]', async () => {
    //   const result = await _contractMultiSig.getOwners();
    //   assert(result.toString() == owners.toString(), 'arr are not same');
    // });
  });
});
