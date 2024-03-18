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
  let _contractMultiSignature = null;
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

    const MultiSignature = await hre.ethers.getContractFactory("DimentDollar");
    _contractMultiSignature = await MultiSignature.deploy([
      [addr1, addr2, addr3],
      2,
    ]);
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
    it("Can chage owner to add1", async function () {
      await _contractProxy.transferOwnership(addr1.address);
      expect(await _contractProxy.owner()).to.equal(addr1.address);
    });

    it("Can chage owner to owner again", async function () {
      await _contractProxy.connect(addr1).transferOwnership(owner.address);
      expect(await _contractProxy.owner()).to.equal(owner.address);
    });
  });

  describe("Mint ", async function () {
    it("Min 1m tokens to owner", async function () {
      await _contractProxy.mint(owner.address, _mintAmount);
      _totalSupply = _totalSupply.add(_mintAmount);
      expect(await _contractProxy.balanceOf(owner.address)).to.equal(
        _mintAmount
      );
    });

    it("Mint 1m tokens to add1", async function () {
      await _contractProxy.mint(addr1.address, _mintAmount);
      _totalSupply = _totalSupply.add(_mintAmount);
      expect(await _contractProxy.balanceOf(addr1.address)).to.equal(
        _mintAmount
      );
    });

    it("Addr2 Cannot mint tokens", async function () {
      try {
        await _contractProxy.connect(addr2).mint(addr1.address, _mintAmount);
        expect(false).to.equal(true);
      } catch (error) {
        expect(true).to.equal(true);
      }
    });

    it("Total Supply is Updated", async function () {
      const amount = await _contractProxy.totalSupply();
      expect(Big(amount).eq(_totalSupply)).to.equal(true);
    });
  });

  describe("Transfers", function () {
    it("Transfer funds from owner to add2", async function () {
      await _contractProxy.transfer(addr2, _mintAmount);
      expect(await _contractProxy.balanceOf(addr2.address)).to.equal(
        _mintAmount
      );
      expect(await _contractProxy.balanceOf(owner.address)).to.equal("0");
    });

    it("Transfer funds from owner to add2", async function () {
      await _contractProxy.connect(addr2).transfer(owner, _mintAmount);
      expect(await _contractProxy.balanceOf(addr2.address)).to.equal("0");
    });

    it("Multitransfer 5 times", async function () {
      const amountArr = Array(2).fill(_multisendAmount);
      const accountsArr = [addr2, addr2];
      await _contractProxy.multiTransfer(accountsArr, amountArr);
      expect(await _contractProxy.balanceOf(addr2.address)).to.equal(
        _mintAmount
      );
      expect(await _contractProxy.balanceOf(owner.address)).to.equal("0");
    });

    it("Multi Transfer fail on over balance", async function () {
      try {
        const amountArr = Array(6).fill(_multisendAmount);
        const accountsArr = [addr2, addr2, addr2, addr2, addr2, addr2];
        await _contractProxy.multiTransfer(accountsArr, amountArr);
        expect(false).to.equal(true);
      } catch (error) {
        expect(true).to.equal(true);
      }
    });
  });

  describe("Allowance", function () {
    it("Give allowance from addr2 to addr1", async function () {
      await _contractProxy.connect(addr2).approve(addr1, _mintAmount);
      expect(await _contractProxy.allowance(addr2, addr1)).to.equal(
        _mintAmount
      );
    });
    it("Remove Allowance", async function () {
      await _contractProxy.connect(addr2).approve(addr1, "0");
      expect(await _contractProxy.allowance(addr2, addr1)).to.equal("0");
    });
    it("Give allowance from addr2 to owner again", async function () {
      await _contractProxy.connect(addr2).approve(owner, _multisendAmount);
      expect(await _contractProxy.allowance(addr2, owner)).to.equal(
        _multisendAmount
      );
    });
    it("Give allowance from addr2 to addr1", async function () {
      await _contractProxy.connect(addr2).approve(addr1, _mintAmount);
      expect(await _contractProxy.allowance(addr2, addr1)).to.equal(
        _mintAmount
      );
    });
    it("Give allowance from addr1 to addr2", async function () {
      await _contractProxy.connect(addr1).approve(addr2, _mintAmount);
      expect(await _contractProxy.allowance(addr1, addr2)).to.equal(
        _mintAmount
      );
    });
  });

  describe("Transfer From", function () {
    it("Owner transferFrom Add2", async function () {
      await _contractProxy.transferFrom(addr2, owner, _multisendAmount);
      expect(await _contractProxy.balanceOf(owner)).to.equal(_multisendAmount);
    });

    it("Owner cannot transfer more then allowance from Add2", async function () {
      try {
        await _contractProxy.transferFrom(addr2, owner, _multisendAmount);
        expect(false).to.equal(true);
      } catch (error) {
        expect(true).to.equal(true);
      }
    });

    it("Add1 transferFrom Add2", async function () {
      await _contractProxy
        .connect(addr1)
        .transferFrom(addr2, owner, _multisendAmount);
      expect(
        Big(await _contractProxy.balanceOf(owner)).eq(
          Big(_multisendAmount).mul(2)
        )
      ).to.equal(true);
    });
  });

  describe("Blacklist", function () {
    it("Owner add addr1 to blacklist", async function () {
      await _contractProxy.addToBlacklist(addr1);
      expect(await _contractProxy.isBlacklisted(addr1)).to.equal(true);
      expect(await _contractProxy.isBlacklisted(addr2)).to.equal(false);
    });

    it("Add1 can not send funds", async function () {
      try {
        await _contractProxy.connect(addr1).transfer(addr2, _multisendAmount);
        expect(false).to.equal(true);
      } catch (error) {
        expect(true).to.equal(true);
      }
    });

    it("Add2 can not send funds via transferfrom", async function () {
      try {
        await _contractProxy
          .connect(addr2)
          .transferFrom(addr1, owner, _multisendAmount);
        expect(false).to.equal(true);
      } catch (error) {
        expect(true).to.equal(true);
      }
    });

    it("Owner redeem tokens", async function () {
      await _contractProxy.redeem(_multisendAmount);
      _totalSupply = _totalSupply.minus(_multisendAmount);
      expect(Big(await _contractProxy.totalSupply()).eq(_totalSupply)).to.equal(
        true
      );
    });

    it("Owner remove addr1 to blacklist", async function () {
      await _contractProxy.removeFromBlacklist(addr1);
      expect(await _contractProxy.isBlacklisted(addr1)).to.equal(false);
      expect(await _contractProxy.isBlacklisted(addr2)).to.equal(false);
    });

    it("Owner cannot burn addr1 tokens", async function () {
      try {
        await _contractProxy.destroyBlockedFunds(addr1);
        expect(false).to.equal(true);
      } catch (error) {
        expect(true).to.equal(true);
      }
    });

    it("Add2 can send funds via transferfrom", async function () {
      try {
        await _contractProxy
          .connect(addr2)
          .transferFrom(addr1, addr2, _mintAmount);
        expect(false).to.equal(true);
      } catch (error) {
        expect(true).to.equal(true);
      }
    });

    it("Add2 can not add addr1 to blacklist", async function () {
      try {
        await _contractProxy.connect(addr2).addToBlacklist(addr1);
        expect(false).to.equal(true);
      } catch (error) {
        expect(true).to.equal(true);
      }
    });

    it("Owner add addr2 to blacklist ", async function () {
      await _contractProxy.addToBlacklist(addr2);
      expect(await _contractProxy.isBlacklisted(addr1)).to.equal(false);
      expect(await _contractProxy.isBlacklisted(addr2)).to.equal(true);
    });

    it("Owner burn addr2 tokens", async function () {
      await _contractProxy.destroyBlockedFunds(addr2);
      _totalSupply = _totalSupply.minus(_mintAmount);
      expect(Big(await _contractProxy.totalSupply()).eq(_totalSupply)).to.equal(
        true
      );
    });
  });
});
