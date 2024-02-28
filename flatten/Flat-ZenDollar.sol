/**
 *  SourceUnit: /Users/mscnmnz/Desktop/DIMENT/DD-Contracts/zen-main-contract/hardhat-0.8.22/contracts/ZenDollarStake.sol
 */

////// SPDX-License-Identifier-FLATTEN-SUPPRESS-WARNING: MIT
pragma solidity 0.8.22;

// Errors
error RequestNotEOA(address user);
error StakeNotExist();
error CanNotSetToZero();
error OverMaxSetLimit();
error ZeroAddress();
error NotEnoughTokens();
error AmountNotInRange();
error TimeNotYet();
error StakeRateNotFound();
error FeeCalculationError();
error NotYourToken();
error StakeIsNotActive();
error CannotHarvestThisStake();
error ZeroRewardHarvest();
error NoRewardLeftInContract();
error CannotExitThisStake();
error ContractBalanceNotEnough();

interface IERC20Permit {
    event Transfer(address indexed from, address indexed to, uint256 value);

    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address to, uint256 value) external returns (bool);

    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);

    function approve(address spender, uint256 value) external returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool);

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function nonces(address owner) external view returns (uint256);

    function DOMAIN_SEPARATOR() external view returns (bytes32);
}

abstract contract Ownable {
    address private _owner;

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    constructor() {
        _setOwner(msg.sender);
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    modifier onlyOwner() {
        require(owner() == msg.sender, "Ownable: caller is not the owner");
        _;
    }

    function renounceOwnership() public virtual onlyOwner {
        _setOwner(address(0));
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(
            newOwner != address(0),
            "Ownable: new owner is the zero address"
        );
        _setOwner(newOwner);
    }

    function _setOwner(address newOwner) private {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

abstract contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

contract ZenDollarStake is Ownable, ReentrancyGuard {
    struct Stake {
        address user;
        uint256 amount;
        uint256 since;
        uint256 rewardRatio;
        uint256 rate;
        bool isActive;
    }

    uint256 public stakeId;
    uint256[] private allStakeIds;

    uint256 public totalStakedAmount;
    uint256 public totalStakeRewardClaimed;

    mapping(address => uint256[]) private stakesByAddress;
    mapping(address => uint256) private stakePlusAddress;

    mapping(uint256 => Stake) public stakedToken;
    mapping(uint256 => uint256) public stakeRates;
    mapping(uint256 => uint256) private totalStakesByRate;

    event Staked(
        address indexed user,
        uint256 amount,
        uint256 timestamp,
        uint256 rewardRatio,
        uint256 rate,
        bool isActive
    );

    event EmergenyWithdrawed(address indexed user, uint256 amount);
    event Harvested(address indexed user, uint256 amount);
    event Exited(address indexed user, uint256 amount);

    event StakeFeeChanged(uint256 feepercent);
    event StakeRateSetted(uint256 amount);
    event EmergenyWithdrawFeeChanged(uint256 percent);
    event StakePlusAmountChanged(uint256 percent);
    event ZenTokenAddressChanged(address newToken);

    IERC20Permit public zenToken;
    uint256 public emergencyFee = 2500; // 25%
    uint256 public stakeFee = 0; // 0%
    address public stakeFeeAddress;
    uint256 public stakePlus = 0; // 0%

    uint256 public maxEmergencyWithdrawRate = 90; // 3 months
    uint256 public minHarvestRate = 180; // 6 months

    uint256 public constant PERCENT_DIVIDER = 10000; // 10_000
    uint256 public minStakeAmount;

    constructor(
        address zenToken_,
        address feeAddress_,
        uint256 minStakeAmount_
    ) {
        stakeFeeAddress = feeAddress_;
        zenToken = IERC20Permit(zenToken_);
        minStakeAmount = minStakeAmount_;

        setStakeRate(30, 350); // 1 month - %3.5
        setStakeRate(90, 490); // 3 month - %4.9
        setStakeRate(180, 650); // 6 month - %6.5
        setStakeRate(270, 700); // 9 month - %7.0
        setStakeRate(360, 760); // 12 month - %7.6
        setStakeRate(540, 920); // 18 month - %9.2
        setStakeRate(720, 1050); // 24 month - %10.5
    }

    modifier onlyEOA() {
        if (tx.origin != msg.sender) {
            revert RequestNotEOA(msg.sender);
        }
        _;
    }

    modifier onlyStakeExist() {
        if (totalStakedAmount <= 0) {
            revert StakeNotExist();
        }
        _;
    }

    modifier stakeRequirementsCheck(uint256 amount, uint256 rate) {
        if (amount < 0 || amount < minStakeAmount) {
            revert AmountNotInRange();
        }

        if (stakeRates[rate] == 0) {
            revert StakeRateNotFound();
        }

        uint256 _addressBalance = zenToken.balanceOf(msg.sender);
        if (_addressBalance < amount) {
            revert NotEnoughTokens();
        }
        _;
    }

    // @dev emergeny withdraw rate limit changer
    function setMaxEmergencyWithdrawRate(uint256 rate) external {
        if (rate <= 0 || stakeRates[rate] <= 0) {
            revert CanNotSetToZero();
        }
        maxEmergencyWithdrawRate = rate;
    }

    // @dev harvest rate limit changer
    function setMinHarvestRate(uint256 rate) external {
        if (rate <= 0 || stakeRates[rate] <= 0) {
            revert CanNotSetToZero();
        }
        minHarvestRate = rate;
    }

    // @dev add stake plus addresses to mapping
    function addStakePlusAddress(
        address[] calldata wallets
    ) external onlyOwner {
        if (wallets.length > 100) {
            revert OverMaxSetLimit();
        }
        for (uint i = 0; i < wallets.length; i++) {
            stakePlusAddress[wallets[i]] = 1;
        }
    }

    // @dev remove address from stake plus mapping cant get plus earning
    function removeAddressFromStakePlus(address wallet) external {
        stakePlusAddress[wallet] = 0;
    }

    // @dev check address stake plus status
    function isStakePlusAddress(
        address wallet
    ) external view returns (uint256) {
        return stakePlusAddress[wallet];
    }

    // @dev setting stake rates
    function setStakeRate(uint256 rate, uint256 rewardRatio) public onlyOwner {
        if (rate <= 0 || rewardRatio <= 0) {
            revert CanNotSetToZero();
        }
        // rate is month rewardRate calculation over PERCENT_DIVIDER be careful
        stakeRates[rate] = rewardRatio;
        emit StakeRateSetted(rate);
    }

    // @dev seting set plus rate
    function setStakePlus(uint256 rate) external onlyOwner {
        // calculation over PERCENT_DIVIDER be careful
        if (rate <= 0 || rate > PERCENT_DIVIDER) {
            revert OverMaxSetLimit();
        }
        stakePlus = rate;
        emit StakePlusAmountChanged(rate);
    }

    // @dev setting emergeny withdraw fee if user want to exit before time limit should pay fee
    function setEmergencyWithdrawFee(uint256 fee) external onlyOwner {
        // can set zero
        // can not set over 25%
        if (fee > 2500 || fee < 0) {
            revert OverMaxSetLimit();
        }
        emergencyFee = fee;
        emit EmergenyWithdrawFeeChanged(fee);
    }

    // @dev if setted every user should pay fee for stake
    function setStakeFee(uint256 fee) external onlyOwner {
        if (fee > 2500 || fee < 0) {
            revert OverMaxSetLimit();
        }
        stakeFee = fee;
        emit StakeFeeChanged(fee);
    }

    // @dev setting stakeing fee address
    function setStakeFeeAddress(address wallet) external onlyOwner {
        if (wallet == address(0)) {
            revert ZeroAddress();
        }
        stakeFeeAddress = wallet;
    }

    // @dev this function is for frontend easy calculations
    function getTotalStakesByRate(
        uint256 rate
    ) external view returns (uint256) {
        return totalStakesByRate[rate];
    }

    // @dev stakeing
    function stake(
        uint256 amount,
        uint256 rate
    )
        external
        nonReentrant
        onlyEOA
        stakeRequirementsCheck(amount, rate)
        returns (uint256)
    {
        // user send tokens to stake contract
        zenToken.transferFrom(msg.sender, address(this), amount);

        return _stake(msg.sender, amount, rate);
    }

    // @dev user can stake for another user
    function stakeFor(
        address wallet,
        uint256 amount,
        uint256 rate
    )
        external
        nonReentrant
        onlyEOA
        stakeRequirementsCheck(amount, rate)
        returns (uint256)
    {
        if (wallet == address(0)) {
            revert ZeroAddress();
        }

        // user send tokens to stake contract
        zenToken.transferFrom(msg.sender, address(this), amount);

        return _stake(wallet, amount, rate);
    }

    /// @dev stake with permit
    function stakeWithPermit(
        uint256 amount,
        uint256 rate,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
        external
        nonReentrant
        onlyEOA
        stakeRequirementsCheck(amount, rate)
        returns (uint256)
    {
        zenToken.permit(msg.sender, address(this), amount, deadline, v, r, s);

        zenToken.transferFrom(msg.sender, address(this), amount);

        return _stake(msg.sender, amount, rate);
    }

    // @dev stakeing internal
    function _stake(
        address wallet,
        uint256 amount,
        uint256 rate
    ) internal returns (uint256) {
        uint256 stakeFeeAmount = 0;
        uint256 stakeAmount = amount;

        if (stakeFee > 0) {
            stakeFeeAmount = (amount * stakeFee) / PERCENT_DIVIDER;

            if (stakeFeeAmount <= 0) {
                revert FeeCalculationError();
            }

            stakeAmount -= stakeFeeAmount;
            // contract send tokens to fee address
            zenToken.transfer(stakeFeeAddress, stakeFeeAmount);
        }

        uint256 _id = ++stakeId;
        allStakeIds.push(_id);
        stakesByAddress[wallet].push(_id);
        totalStakesByRate[rate] += stakeAmount;

        totalStakedAmount += stakeAmount;

        stakedToken[_id].user = wallet;
        stakedToken[_id].amount = stakeAmount;
        stakedToken[_id].since = block.timestamp;
        stakedToken[_id].rewardRatio = stakeRates[rate];
        stakedToken[_id].rate = rate;
        stakedToken[_id].isActive = true;

        emit Staked(
            msg.sender,
            stakeAmount,
            block.timestamp,
            stakeRates[rate],
            rate,
            true
        );

        return _id;
    }

    // @dev get rewards in pool
    function getRewardsLeft() public view returns (uint256) {
        uint256 contractTotalBalance = zenToken.balanceOf(address(this));
        return contractTotalBalance - totalStakedAmount;
    }

    // @dev calculate stake reward
    function calculateStakeRewards(uint256 id) public view returns (uint256) {
        uint256 rewardAmount = (stakedToken[id].rewardRatio *
            stakedToken[id].amount) / PERCENT_DIVIDER;

        return rewardAmount;
    }

    // @dev user can harvest tokens every 30d
    function harvest(uint256 id) external nonReentrant onlyEOA onlyStakeExist {
        if (msg.sender != stakedToken[id].user) {
            revert NotYourToken();
        }

        if (!stakedToken[id].isActive) {
            revert StakeIsNotActive();
        }

        if (stakedToken[id].rate < minHarvestRate) {
            revert CannotHarvestThisStake();
        }

        if (block.timestamp < stakedToken[id].since + 30 days) {
            revert TimeNotYet();
        }

        uint256 stakeMonthlyReward = _harvest(id);
        if (stakeMonthlyReward <= 0) {
            revert ZeroRewardHarvest();
        }
        require(stakeMonthlyReward > 0, "ZD Stake: monthly reward is zero");

        // total rewards update
        totalStakeRewardClaimed += stakeMonthlyReward;

        // stake time update with timestamp
        stakedToken[id].since = block.timestamp;

        // wallet recive tokens
        zenToken.transfer(msg.sender, stakeMonthlyReward);

        emit Harvested(msg.sender, stakeMonthlyReward);
    }

    // @dev harvest internal
    function _harvest(uint256 id) internal view returns (uint256) {
        uint256 rewardsLeftInContract = getRewardsLeft();
        if (rewardsLeftInContract <= 0) {
            revert NoRewardLeftInContract();
        }

        uint256 stakePlusReward = 0;

        // divide should be apply to calculate day as integer
        uint256 totalDaysPast = (block.timestamp - stakedToken[id].since) /
            1 days;

        if (totalDaysPast <= 0) {
            revert TimeNotYet();
        }

        uint256 _daysPastRewardRate = (totalDaysPast *
            stakedToken[id].rewardRatio) / (stakedToken[id].rate);

        uint256 eRewardAmount = (stakedToken[id].amount * _daysPastRewardRate) /
            PERCENT_DIVIDER;

        if (stakePlusAddress[stakedToken[id].user] > 0) {
            stakePlusReward =
                (stakedToken[id].amount * stakePlus) /
                PERCENT_DIVIDER;
        }

        eRewardAmount += stakePlusReward;

        if (eRewardAmount <= 0) {
            revert ZeroRewardHarvest();
        }

        if (rewardsLeftInContract < eRewardAmount) {
            eRewardAmount = rewardsLeftInContract;
        }

        return eRewardAmount;
    }

    // @dev user can exit from pool when stake finish
    function exit(uint256 id) external nonReentrant onlyEOA onlyStakeExist {
        if (!stakedToken[id].isActive) {
            revert StakeIsNotActive();
        }

        if (msg.sender != stakedToken[id].user) {
            revert NotYourToken();
        }

        if (
            block.timestamp <
            stakedToken[id].since + (stakedToken[id].rate * 1 days)
        ) {
            revert TimeNotYet();
        }

        stakedToken[id].isActive = false;

        uint256 stakeAndReward = _exit(id);

        zenToken.transfer(stakedToken[id].user, stakeAndReward);

        emit Exited(stakedToken[id].user, stakeAndReward);
    }

    // @dev exit internal
    function _exit(uint256 id) internal returns (uint256) {
        uint256 stakeAmount = stakedToken[id].amount;
        uint256 rewardAmount = calculateStakeRewards(id);

        uint256 rewardsLeftInContract = getRewardsLeft();

        if (rewardsLeftInContract < rewardAmount) {
            rewardAmount = rewardsLeftInContract;
        }

        totalStakedAmount -= stakedToken[id].amount;

        totalStakesByRate[stakedToken[id].rate] -= stakedToken[id].amount;

        totalStakeRewardClaimed += rewardAmount;

        return stakeAmount + rewardAmount;
    }

    // @dev user can withdraw before time finish but should pay fee
    function emergencyWithdraw(
        uint256 id
    ) external nonReentrant onlyEOA onlyStakeExist {
        if (!stakedToken[id].isActive) {
            revert StakeIsNotActive();
        }

        if (msg.sender != stakedToken[id].user) {
            revert NotYourToken();
        }

        if (stakedToken[id].rate > maxEmergencyWithdrawRate) {
            revert CannotExitThisStake();
        }

        if (zenToken.balanceOf(address(this)) < stakedToken[id].amount) {
            revert ContractBalanceNotEnough();
        }

        stakedToken[id].isActive = false;

        totalStakedAmount -= stakedToken[id].amount;

        totalStakesByRate[stakedToken[id].rate] -= stakedToken[id].amount;

        uint256 feeAmount = 0;

        if (emergencyFee > 0) {
            feeAmount =
                (stakedToken[id].amount * emergencyFee) /
                PERCENT_DIVIDER;
            // send fee to fee address
            zenToken.transfer(stakeFeeAddress, feeAmount);
        }

        uint256 afterFee = stakedToken[id].amount - feeAmount;
        // send balance after fee staked tokens to user
        zenToken.transfer(msg.sender, afterFee);

        emit EmergenyWithdrawed(msg.sender, stakedToken[id].amount);
    }

    // @dev easy for frontend all ids
    function getAddressAllStakeIds(
        address wallet
    ) external view returns (uint256[] memory) {
        return stakesByAddress[wallet];
    }

    // @dev easy for frontend stake details
    function getSingleStakeDetails(
        uint256 id
    )
        external
        view
        returns (
            address user,
            uint256 amount,
            uint256 since,
            uint256 rewardRatio,
            uint256 rate,
            bool isActive
        )
    {
        return (
            stakedToken[id].user,
            stakedToken[id].amount,
            stakedToken[id].since,
            stakedToken[id].rewardRatio,
            stakedToken[id].rate,
            stakedToken[id].isActive
        );
    }

    // @dev easy for frontend get total stake amount
    function getAddressActiveTotalStakedAmount(
        address wallet
    ) external view returns (uint256) {
        uint256[] memory userStakes = stakesByAddress[wallet];

        uint256 totalStaked = 0;
        for (uint256 i = 0; i < userStakes.length; i++) {
            if (stakedToken[userStakes[i]].isActive) {
                totalStaked += stakedToken[userStakes[i]].amount;
            }
        }
        return totalStaked;
    }
}
