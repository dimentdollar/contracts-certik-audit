const { expect } = require("chai");
const { Big } = require("big.js");
const hre = require("hardhat");

const helpers = require("@nomicfoundation/hardhat-network-helpers");

let MAX_UNIT =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

describe("Diment Dollar Stake", function () {
  let _contractProxy = null;
  let _contractStake = null;

  let _zenDecimals = 6;
  // 1m USD 96 099 720
  let _mintAmount = hre.ethers.parseUnits("1000", _zenDecimals);
  let _sendAmount = hre.ethers.parseUnits("100", _zenDecimals);
  let _minAmount = hre.ethers.parseUnits("1", _zenDecimals);
  let _withOutFee = Big(_sendAmount).mul(90).div(100);

  let _emergenyApplied = Big(_withOutFee).mul(75).div(100);
  let _totalSupply = Big(0);

  let divider = 10000;

  let _stakeAddress = null;
  let _proxyAddress = null;
  let owner = null;
  let addr1 = null;
  let addr2 = null;
  let addr3 = null;
  let addr4 = null; // fee adress

  before(async () => {
    [owner, addr1, addr2, addr3, addr4] = await hre.ethers.getSigners();
    const DimentDollar = await hre.ethers.getContractFactory("DimentDollar");

    _contractProxy = await hre.upgrades.deployProxy(DimentDollar, [
      "Diment Dollar",
      "DD",
      6,
    ]);

    _proxyAddress = await _contractProxy.getAddress();

    _contractStake = await hre.ethers.deployContract("DimentDollarStake", [
      _proxyAddress,
      addr4,
      _minAmount,
    ]);
    _stakeAddress = await _contractStake.getAddress();
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

    it("Mint tokens", async () => {
      try {
        await _contractProxy.mint(owner.address, _mintAmount);
        const result = await _contractProxy.totalSupply();
        _totalSupply = _totalSupply.add(_mintAmount);
        expect(result.toString()).to.equal(_totalSupply.toString());
      } catch (err) {
        expect(false).to.equal(true);
      }
    });

    it("Transfer tokens to addd1 from owner", async () => {
      try {
        await _contractProxy.transfer(addr1.address, _sendAmount);
        const result = await _contractProxy.balanceOf(addr1.address);
        expect(result.toString()).to.equal(_sendAmount.toString());
      } catch (err) {
        expect(false).to.equal(true);
      }
    });

    it("Transfer tokens to addd2 from owner", async () => {
      try {
        await _contractProxy.transfer(addr2.address, _sendAmount);
        const result = await _contractProxy.balanceOf(addr2.address);
        expect(result.toString()).to.equal(_sendAmount.toString());
      } catch (err) {
        expect(false).to.equal(true);
      }
    });
  });

  describe("Stake Contract Check", () => {
    it("Stake Fee Address", async () => {
      expect(await _contractStake.stakeFeeAddress()).to.eq(addr4.address);
    });

    it("Stake Token is Diment Dollar", async () => {
      expect(await _contractStake.dimentDollar()).to.eq(_proxyAddress);
    });

    it("Total Staked Amount is zero", async () => {
      const result = await _contractStake.totalStakedAmount();
      expect(result.toString()).to.eq("0");
    });

    it("Set Stake Times", async () => {
      try {
        await _contractStake.setStakeRate(30, 350);
        await _contractStake.setStakeRate(90, 490);
        await _contractStake.setStakeRate(180, 650);
        await _contractStake.setStakeRate(270, 700);
        await _contractStake.setStakeRate(360, 760);
        await _contractStake.setStakeRate(540, 920);
        await _contractStake.setStakeRate(720, 1050);
        expect(true).to.equal(true);
      } catch (error) {
        expect(false).to.equal(true);
      }
    });

    it("Change Min harvest time to 3 months", async () => {
      await _contractStake.setMinHarvestTerm(90);
      const result = await _contractStake.minHarvestTerm();
      expect(result.toString()).to.eq("90");
    });

    it("Change Max Emergency withdraw to 6 months", async () => {
      await _contractStake.setMaxEmergencyWithdrawTerm(180);
      const result = await _contractStake.maxEmergencyWithdrawTerm();
      expect(result.toString()).to.eq("180");
    });

    it("Account[0] can stake get stake plus", async () => {
      const result = await _contractStake.isStakePlusAddress(owner.address);
      expect(result.toString()).to.eq("0");
    });

    it("Add account[0] to get stake plus", async () => {
      await _contractStake.addStakePlusAddress([owner.address]);
      const result = await _contractStake.isStakePlusAddress(owner.address);
      expect(result.toString()).to.eq("1");
    });

    it("Total Reward Claimed Amount is zero", async () => {
      const result = await _contractStake.totalRewardClaimed();
      expect(result.toString()).to.eq("0");
    });

    it("Emergency Fee is 25%", async () => {
      const result = await _contractStake.emergencyFee();
      expect(result.toString()).to.eq("2500");
    });

    it("Cannot Change Emergency Fee to 50%", async () => {
      try {
        await _contractStake.setEmergencyWithdrawFee(5000);
        expect(false).to.equal(true);
      } catch {
        expect(true).to.equal(true);
      }
    });

    it("Stake Fee is %1", async () => {
      const result = await _contractStake.stakeFee();
      expect(result.toString()).to.eq("0");
    });

    it("Change Stake Fee to %10", async () => {
      await _contractStake.setStakeFee(1000);
      const result = await _contractStake.stakeFee();
      expect(result.toString()).to.eq("1000");
    });

    it("Stake Plus is %0", async () => {
      const result = await _contractStake.stakePlus();
      expect(result.toString()).to.eq("0");
    });

    it("Change Stake Plus to %10", async () => {
      await _contractStake.setStakePlus(1000);
      const result = await _contractStake.stakePlus();
      expect(result.toString()).to.eq("1000");
    });

    it("Stake Ids start from zero", async () => {
      const result = await _contractStake.stakeId();
      expect(result.toString()).to.eq("0");
    });

    it("Get Stake Rate for 1 month(%3.5)", async () => {
      const result = await _contractStake.stakeRates(30);
      expect(result.toString()).to.eq("350");
    });

    it("Change Stake Rate for 1 month to %1", async () => {
      await _contractStake.setStakeRate(30, 100);
      const result = await _contractStake.stakeRates(30);
      expect(result.toString()).to.eq("100");
    });

    it("Get Reward Left is 0", async () => {
      const result = await _contractStake.totalRewardsLeft();
      expect(result.toString()).to.eq("0");
    });

    it("Diment Dollar Token Transfer to stake contract", async () => {
      await _contractProxy.transfer(_stakeAddress, _sendAmount);
      const result = await _contractProxy.balanceOf(_stakeAddress);
      expect(result).to.eq(_sendAmount);
    });
  });

  describe("Give Allowance to Stake Contract", () => {
    it("Diment Dollar Stake Allowance account[0]", async () => {
      await _contractProxy.connect(owner).approve(_stakeAddress, MAX_UNIT);

      const result = await _contractProxy
        .connect(owner)
        .allowance(owner, _stakeAddress);

      expect(result.toString()).to.eq(MAX_UNIT);
    });

    it("Diment Dollar Stake Allowance account[1]", async () => {
      await _contractProxy.connect(addr1).approve(_stakeAddress, MAX_UNIT);

      const result = await _contractProxy
        .connect(addr1)
        .allowance(addr1, _stakeAddress);

      expect(result.toString()).to.eq(MAX_UNIT);
    });

    it("Diment Dollar Stake Allowance account[2]", async () => {
      await _contractProxy.connect(addr2).approve(_stakeAddress, MAX_UNIT);

      const result = await _contractProxy
        .connect(addr2)
        .allowance(addr2, _stakeAddress);

      expect(result.toString()).to.eq(MAX_UNIT);
    });
  });

  describe("Stake", () => {
    it("Add rewards to contract", async () => {
      await _contractStake.addRewardsToContract(_sendAmount);
    });

    it("Get Reward Left is 1000000", async () => {
      const result = await _contractStake.totalRewardsLeft();
      expect(result).to.eq(_sendAmount);
    });

    it("Stake with account[0]", async () => {
      await _contractStake.stake(_sendAmount, 30);
      const result = await _contractStake.getAddressAllStakeIds(owner.address);
      expect(result.toString()).to.eq("1");
    });

    it("Stake Ids is now 1", async () => {
      const result = await _contractStake.stakeId();
      expect(result.toString()).to.eq("1");
    });

    it("Stake rewards calculation correct", async () => {
      const result = await _contractStake.calculateStakeRewards(1);
      expect(result.toString()).to.eq(
        _withOutFee.mul(100).div(divider).toString()
      );
    });

    it("10% fee Stake Fee payed to fee address", async () => {
      const result = await _contractProxy.balanceOf(addr4.address);
      expect(result.toString()).to.eq(
        Big(_sendAmount).mul(10).div(100).toString()
      );
    });

    it("Total Staked Amount is 900000 - 10% fee applied", async () => {
      const result = await _contractStake.totalStakedAmount();

      expect(result.toString()).to.eq(_withOutFee.toString());
    });

    it("Wallet Stake details are correct", async () => {
      const result = await _contractStake.getSingleStakeDetails(1);

      expect(result[0]).to.eq(owner.address);
      expect(result[1].toString()).to.eq(_withOutFee.toString());
      expect(result[3].toString()).to.eq("100");
      expect(result[4].toString()).to.eq("30");
      expect(result[5]).to.eq(1);
    });

    it("Wallet total stake amount is correct", async () => {
      const result = await _contractStake.getAddressActiveTotalStakedAmount(
        owner.address
      );
      expect(result.toString()).to.eq(_withOutFee.toString());
    });
  });

  describe("Emergenct Withraw", () => {
    it("Stake with account[1]", async () => {
      await _contractStake.connect(addr1).stake(_sendAmount, 90);
      const result = await _contractStake.getAddressAllStakeIds(addr1.address);
      expect(result.toString()).to.eq("2");
    });

    it("Stake Ids is now 2", async () => {
      const result = await _contractStake.stakeId();
      expect(result.toString()).to.eq("2");
    });

    it("Wallet Stake details are correct", async () => {
      const result = await _contractStake.getSingleStakeDetails(2);
      expect(result[0]).to.eq(addr1.address);
      expect(result[1].toString()).to.eq(_withOutFee.toString());
      expect(result[3].toString()).to.eq("490");
      expect(result[4].toString()).to.eq("90");
      expect(result[5]).to.eq(1);
    });

    it("Emergeny Withdraw with addr 1 stake withdraw to false", async () => {
      try {
        await _contractStake.connect(addr1).emergencyWithdraw(2);
      } catch (err) {
        console.log(err);
      }
      const result = await _contractStake.getSingleStakeDetails(2);

      expect(result[5]).to.eq(0);
    });

    it("25% Emergeny fee appyled to addr 1", async () => {
      const result = await _contractProxy.balanceOf(addr1.address);
      expect(result.toString()).to.eq(_emergenyApplied.toString());
    });
  });

  describe("Harvet Tokens", () => {
    it("Stake with account[0] x2", async () => {
      await _contractStake.stake(_sendAmount, 180);
      const result = await _contractStake.getAddressAllStakeIds(owner.address);
      expect(result.toString()).to.eq("1,3");
    });

    it("Stake Ids is now 3", async () => {
      const result = await _contractStake.stakeId();
      expect(result.toString()).to.eq("3");
    });

    it("Can not harvest token before 30days", async () => {
      try {
        await _contractStake.harvest(3);
        expect(false).to.eq(true);
      } catch (err) {
        expect(true).to.eq(true);
      }
    });

    it("Can harvest earnings with stake Plus", async () => {
      const oldBalance = await _contractProxy.balanceOf(owner.address);
      await helpers.time.increase(60 * 60 * 24 * 30);
      await _contractStake.harvest(3);
      const newBalance = await _contractProxy.balanceOf(owner.address);
      expect(newBalance).to.greaterThan(oldBalance);
    });

    it("Remove account[0] to get stake plus", async () => {
      await _contractStake.removeAddressFromStakePlus(owner.address);
      const result = await _contractStake.isStakePlusAddress(owner.address);
      expect(result.toString()).to.eq("0");
    });

    it("Can not harvest again id3", async () => {
      try {
        await _contractStake.harvest(3);
        expect(false).to.eq(true);
      } catch (err) {
        expect(true).to.eq(true);
      }
    });
  });

  describe("Withraw and Exit Stake with Rewards", () => {
    it("Cannot exit before time finish Exit from pool", async () => {
      try {
        await _contractStake.exit(3);
        expect(false).to.eq(true);
      } catch {
        expect(true).to.eq(true);
      }
    });

    it("Owner id1 Exit from pool with earnings", async () => {
      const oldBalance = await _contractProxy.balanceOf(owner.address);
      await helpers.time.increase(60 * 60 * 24 * 30);
      try {
        await _contractStake.exit(1);
      } catch (error) {
        console.log(error);
      }

      const newBalance = await _contractProxy.balanceOf(owner.address);

      expect(newBalance).to.greaterThan(oldBalance);
    });

    it("Owner id3 Exit from pool with earnings", async () => {
      const oldBalance = await _contractProxy.balanceOf(owner.address);
      await helpers.time.increase(60 * 60 * 24 * 150);
      try {
        await _contractStake.exit(3);
      } catch (error) {
        console.log(error);
      }

      const newBalance = await _contractProxy.balanceOf(owner.address);
      expect(newBalance).to.greaterThan(oldBalance);
    });

    it("Total Reward Claimed Amount is correct", async () => {
      const result = await _contractStake.totalRewardClaimed();
      expect(+result.toString()).to.greaterThan(0);
    });

    it("Cannot exit again", async () => {
      try {
        await _contractStake.exit(3);
        expect(false).to.eq(true);
      } catch {
        expect(true).to.eq(true);
      }
    });
  });

  describe("Stake Amounts Check", () => {
    it("Stake with account[2]", async () => {
      await _contractStake.connect(addr2).stake(_sendAmount, 720);
      const result = await _contractStake.getAddressAllStakeIds(addr2.address);
      expect(result.toString()).to.eq("4");
    });
    it("Stake Ids is now 1", async () => {
      const result = await _contractStake.stakeId();
      expect(result.toString()).to.eq("4");
    });
    it("Stake rewards calculation correct", async () => {
      const result = await _contractStake.calculateStakeRewards(4);
      expect(result.toString()).to.eq(
        _withOutFee.mul(1050).div(divider).toString()
      );
    });

    it("Wallet Stake details are correct", async () => {
      const result = await _contractStake.getSingleStakeDetails(4);
      expect(result[0]).to.eq(addr2.address);
      expect(result[1].toString()).to.eq(_withOutFee.toString());
      expect(result[3].toString()).to.eq("1050");
      expect(result[4].toString()).to.eq("720");
      expect(result[5]).to.eq(1);
    });

    it("Wallet total stake amount is correct", async () => {
      const result = await _contractStake.getAddressActiveTotalStakedAmount(
        addr2.address
      );
      expect(result.toString()).to.eq(_withOutFee.toString());
    });

    it("Exit total token amount is correct", async () => {
      const oldBalance = await _contractProxy.balanceOf(addr2.address);

      await helpers.time.increase(24 * 60 * 60 * 720);

      try {
        await _contractStake.connect(addr2).exit(4);
        expect(true).to.eq(true);
      } catch (err) {
        console.log(err);
        expect(false).to.eq(true);
      }
      const newBalance = await _contractProxy.balanceOf(addr2.address);
      expect(newBalance).to.greaterThan(oldBalance);
    });
  });

  describe("Stake requirements check", () => {
    it("Cannot Stake with account[3]", async () => {
      try {
        await _contractStake.connect(addr3).stake(_sendAmount, 720);
        expect(false).to.eq(true);
      } catch (err) {
        //console.log(err);
        expect(true).to.eq(true);
      }
    });

    it("Cannot Stake under min amount with account[2]", async () => {
      try {
        await _contractStake.connect(addr2).stake("999999", 30);
        expect(false).to.eq(true);
      } catch (err) {
        //console.log(err);
        expect(true).to.eq(true);
      }
    });

    it("Cannot Stake under min amount with account[2]", async () => {
      try {
        await _contractStake.connect(addr2).stake(_minAmount, 29);
        expect(false).to.eq(true);
      } catch (err) {
        //console.log(err);
        expect(true).to.eq(true);
      }
    });
  });

  describe("Admin funcs cannot call", () => {
    it("Cannot call add stake plus", async () => {
      try {
        await _contractStake.connect(addr3).addStakePlusAddress([addr4, addr3]);
        expect(false).to.eq(true);
      } catch (err) {
        //console.log(err);
        expect(true).to.eq(true);
      }
    });

    it("Cannot remove Address From Stake Plus with addr2", async () => {
      try {
        await _contractStake.connect(addr2).removeAddressFromStakePlus(addr1);
        expect(false).to.eq(true);
      } catch (err) {
        //console.log(err);
        expect(true).to.eq(true);
      }
    });

    it("Cannot set Stake Rate with addr2", async () => {
      try {
        await _contractStake.connect(addr2).setStakeRate(45, 450);
        expect(false).to.eq(true);
      } catch (err) {
        //console.log(err);
        expect(true).to.eq(true);
      }
    });
  });
});
