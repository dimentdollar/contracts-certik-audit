// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

// Errors
error RequestNotEOA(address user);
error StakeNotExist();
error CanNotSetToZero();
error OverMaxSetLimit();
error ZeroAddress();
error NotEnoughTokens();
error AmountNotInRange();
error NotInRange();
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
error CanNotAddZero();
error NotEnoughTokensForStakeReward();

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

contract DimentDollarStake is Ownable, ReentrancyGuard {
    // user events
    event Staked(
        uint256 amount,
        uint256 timestamp,
        address indexed user,
        uint32 rewardRatio,
        uint32 rate,
        uint8 isActive
    );
    event EmergenyWithdrawed(address indexed user, uint256 amount);
    event Harvested(address indexed user, uint256 amount);
    event Exited(address indexed user, uint256 amount);

    // owner events
    event StakeFeeChanged(uint256 feepercent);
    event StakeRateSetted(uint256 amount);
    event EmergenyWithdrawFeeChanged(uint32 percent);
    event MaxEmergencyWithdrawRateChange(uint32 percent);
    event MinHarvestRateChange(uint32 rate);
    event MinStakeAmountChanged(uint256 amount);
    event StakePlusAmountChanged(uint32 percent);
    event StakePlusAddressAdded(address[] wallets);
    event StakePlusAddressStatusChanges(address wallet);
    event StakeFeeAddressChanged(address wallet);
    event RewardsFromContract(uint256 amount);
    event RewardsAddedToContract(uint256 amount);

    IERC20Permit public immutable dimentDollar;
    struct Stake {
        uint256 amount;
        uint256 since;
        address user;
        uint32 rewardRatio;
        uint32 rate;
        uint8 isActive;
    }

    uint256 public constant PERCENT_DIVIDER = 10_000; // 10_000
    uint256 public constant MAX_STAKE_RATE = 10_000; // 10_000 will multiply by date

    uint256 public minStakeAmount;

    uint256 public totalStakedAmount;
    uint256 public totalStakeRewardClaimed;
    uint256 public totalRewardsLeft;

    address public stakeFeeAddress;

    uint32 public emergencyFee = 2_500; // 25%
    uint32 public stakeFee = 0; // 0%
    uint32 public stakePlus = 0; // 0%

    uint32 public maxEmergencyWithdrawRate = 90; // 3 months
    uint32 public minHarvestRate = 180; // 6 months

    uint16 public stakeId;
    uint16[] private allStakeIds;

    mapping(address => uint16[]) private stakesByAddress;
    mapping(address => uint8) private stakePlusAddress;

    mapping(uint32 => Stake) public stakedToken;
    mapping(uint32 => uint32) public stakeRates;
    mapping(uint32 => uint256) private totalStakesByRate;

    constructor(
        address dimentDollar_,
        address feeAddress_,
        uint256 minStakeAmount_
    ) {
        if (feeAddress_ == address(0)) {
            revert ZeroAddress();
        }

        stakeFeeAddress = feeAddress_;
        dimentDollar = IERC20Permit(dimentDollar_);
        minStakeAmount = minStakeAmount_;
    }

    modifier onlyEOA() {
        if (tx.origin != msg.sender) {
            revert RequestNotEOA(msg.sender);
        }
        _;
    }

    modifier onlyStakesExist() {
        if (totalStakedAmount == 0) {
            revert StakeNotExist();
        }
        _;
    }

    modifier stakeRequirementsCheck(uint256 amount, uint32 rate) {
        if (amount < minStakeAmount) {
            revert AmountNotInRange();
        }

        if (stakeRates[rate] == 0) {
            revert StakeRateNotFound();
        }

        uint256 _addressBalance = dimentDollar.balanceOf(msg.sender);
        if (_addressBalance < amount) {
            revert NotEnoughTokens();
        }

        // toplam stake reward kazanacagi miktardan az mi cok mu
        uint256 rewardAmount = (stakeRates[rate] * amount) / PERCENT_DIVIDER;
        if (rewardAmount > totalRewardsLeft) {
            revert NotEnoughTokensForStakeReward();
        }
        _;
    }

    // @dev emergeny withdraw rate limit changer
    function setMaxEmergencyWithdrawRate(uint32 rate) external onlyOwner {
        if (rate == 0 || stakeRates[rate] == 0) {
            revert CanNotSetToZero();
        }
        if (rate > MAX_STAKE_RATE) {
            revert NotInRange();
        }

        maxEmergencyWithdrawRate = rate;
        emit MaxEmergencyWithdrawRateChange(rate);
    }

    // @dev harvest rate limit changer
    function setMinHarvestRate(uint32 rate) external onlyOwner {
        if (rate == 0 || stakeRates[rate] == 0) {
            revert CanNotSetToZero();
        }

        if (rate > MAX_STAKE_RATE) {
            revert NotInRange();
        }
        minHarvestRate = rate;
        emit MinHarvestRateChange(rate);
    }

    // @dev min stake amount changer
    function setMinStakeAmount(uint256 amount) external onlyOwner {
        if (amount == 0) {
            revert AmountNotInRange();
        }
        minStakeAmount = amount;
        emit MinStakeAmountChanged(amount);
    }

    // @dev add stake plus addresses to mapping
    function addStakePlusAddress(
        address[] calldata wallets
    ) external onlyOwner {
        uint _walletLength = wallets.length;

        if (_walletLength > 100) {
            revert OverMaxSetLimit();
        }
        for (uint i = 0; i < _walletLength; i++) {
            if (wallets[i] == address(0)) {
                revert ZeroAddress();
            }
            stakePlusAddress[wallets[i]] = 1;
        }
        emit StakePlusAddressAdded(wallets);
    }

    // @dev remove address from stake plus mapping cant get plus earning
    function removeAddressFromStakePlus(address wallet) external onlyOwner {
        if (wallet == address(0)) {
            revert ZeroAddress();
        }
        stakePlusAddress[wallet] = 0;
        emit StakePlusAddressStatusChanges(wallet);
    }

    // @dev check address stake plus status
    function isStakePlusAddress(address wallet) external view returns (uint8) {
        return stakePlusAddress[wallet];
    }

    // @dev setting stake rates
    function setStakeRate(uint32 rate, uint32 rewardRatio) public onlyOwner {
        if (rate == 0 || rewardRatio == 0) {
            revert CanNotSetToZero();
        }

        if (rate > MAX_STAKE_RATE) {
            revert NotInRange();
        }

        // check rate is in range
        if (rewardRatio > PERCENT_DIVIDER) {
            revert NotInRange();
        }

        // rate is month rewardRate calculation over PERCENT_DIVIDER be careful
        stakeRates[rate] = rewardRatio;
        emit StakeRateSetted(rate);
    }

    // @dev seting set plus rate
    function setStakePlus(uint32 raito) external onlyOwner {
        // calculation over PERCENT_DIVIDER be careful
        if (raito == 0 || raito > PERCENT_DIVIDER) {
            revert NotInRange();
        }

        stakePlus = raito;
        emit StakePlusAmountChanged(raito);
    }

    // @dev setting emergeny withdraw fee if user want to exit before time limit should pay fee
    function setEmergencyWithdrawFee(uint32 fee) external onlyOwner {
        // can set 0% to 25%
        // can not set over 25%
        if (fee > 2_500) {
            revert OverMaxSetLimit();
        }

        emergencyFee = fee;
        emit EmergenyWithdrawFeeChanged(fee);
    }

    // @dev if setted every user should pay fee for stake
    function setStakeFee(uint32 fee) external onlyOwner {
        // can set 0% to 25%
        // can not set over 25%
        if (fee > 2_500) {
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
        emit StakeFeeAddressChanged(wallet);
    }

    // @dev this function is for frontend easy calculations
    function getTotalStakesByRate(uint32 rate) external view returns (uint256) {
        return totalStakesByRate[rate];
    }

    // @dev stakeing
    function stake(
        uint256 amount,
        uint32 rate
    )
        external
        nonReentrant
        onlyEOA
        stakeRequirementsCheck(amount, rate)
        returns (uint16)
    {
        // user send tokens to stake contract
        require(
            dimentDollar.transferFrom(msg.sender, address(this), amount),
            "Transfer Error"
        );

        return _stake(msg.sender, amount, rate);
    }

    // @dev user can stake for another user
    function stakeFor(
        address wallet,
        uint256 amount,
        uint32 rate
    )
        external
        nonReentrant
        onlyEOA
        stakeRequirementsCheck(amount, rate)
        returns (uint16)
    {
        if (wallet == address(0)) {
            revert ZeroAddress();
        }

        // user send tokens to stake contract
        require(
            dimentDollar.transferFrom(msg.sender, address(this), amount),
            "Transfer Error"
        );

        return _stake(wallet, amount, rate);
    }

    /// @dev stake with permit
    function stakeWithPermit(
        uint256 amount,
        uint32 rate,
        uint32 deadline,
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
        dimentDollar.permit(
            msg.sender,
            address(this),
            amount,
            deadline,
            v,
            r,
            s
        );

        require(
            dimentDollar.transferFrom(msg.sender, address(this), amount),
            "Transfer Error"
        );

        return _stake(msg.sender, amount, rate);
    }

    // @dev stakeing internal
    function _stake(
        address wallet,
        uint256 amount,
        uint32 rate
    ) internal returns (uint16) {
        uint256 stakeFeeAmount = 0;
        uint256 stakeAmount = amount;

        if (stakeFee > 0) {
            stakeFeeAmount = (amount * stakeFee) / PERCENT_DIVIDER;

            if (stakeFeeAmount == 0) {
                revert FeeCalculationError();
            }

            stakeAmount -= stakeFeeAmount;
            // contract send tokens to fee address
            require(
                dimentDollar.transfer(stakeFeeAddress, stakeFeeAmount),
                "Fee Tranfer Error"
            );
        }

        uint16 _id = ++stakeId;

        allStakeIds.push(_id);
        stakesByAddress[wallet].push(_id);
        totalStakesByRate[rate] += stakeAmount;
        totalStakedAmount += stakeAmount;

        // calculate rewards via staked amount
        uint256 rewardAmount = (stakeRates[rate] * stakeAmount) /
            PERCENT_DIVIDER;
        totalRewardsLeft -= rewardAmount;

        Stake memory stakeToSave = Stake({
            user: wallet,
            amount: stakeAmount,
            since: block.timestamp,
            rewardRatio: stakeRates[rate],
            rate: rate,
            isActive: 1
        });

        stakedToken[_id] = stakeToSave;

        emit Staked(
            stakeAmount,
            block.timestamp,
            msg.sender,
            stakeRates[rate],
            rate,
            1
        );

        return _id;
    }

    // @dev calculate stake reward
    function calculateStakeRewards(uint16 id) public view returns (uint256) {
        uint256 rewardAmount = (stakedToken[id].rewardRatio *
            stakedToken[id].amount) / PERCENT_DIVIDER;
        return rewardAmount;
    }

    // @dev user can harvest tokens every 30d
    function harvest(uint16 id) external nonReentrant onlyEOA onlyStakesExist {
        Stake memory stakeToHarvest = stakedToken[id];
        if (msg.sender != stakeToHarvest.user) {
            revert NotYourToken();
        }

        if (stakeToHarvest.isActive == 0) {
            revert StakeIsNotActive();
        }

        if (stakeToHarvest.rate < minHarvestRate) {
            revert CannotHarvestThisStake();
        }

        if (block.timestamp < stakeToHarvest.since + 30 days) {
            revert TimeNotYet();
        }

        uint256 stakeMonthlyReward = _harvest(stakeToHarvest);

        if (stakeMonthlyReward == 0) {
            revert ZeroRewardHarvest();
        }

        // check user can make stake again
        // every harvest is update time so need to check stake reward left in contract
        uint256 rewardAmount = (stakeToHarvest.rewardRatio *
            stakeToHarvest.amount) / PERCENT_DIVIDER;

        if (rewardAmount > totalRewardsLeft - stakeMonthlyReward) {
            revert NotEnoughTokensForStakeReward();
        }

        // total rewards update
        totalStakeRewardClaimed += stakeMonthlyReward;

        // total rewards claim update
        totalRewardsLeft -= stakeMonthlyReward;

        // stake time update with timestamp
        stakedToken[id].since = block.timestamp;

        emit Harvested(msg.sender, stakeMonthlyReward);

        // wallet recive tokens
        require(
            dimentDollar.transfer(msg.sender, stakeMonthlyReward),
            "Transfer Error"
        );
    }

    // @dev harvest internal
    function _harvest(
        Stake memory stakeToHarvest
    ) internal view returns (uint256) {
        if (totalRewardsLeft == 0) {
            revert NoRewardLeftInContract();
        }

        uint256 stakePlusReward = 0;

        // divide should be apply to calculate day as integer
        uint256 totalDaysPast = (block.timestamp - stakeToHarvest.since) /
            1 days;

        if (totalDaysPast == 0) {
            revert TimeNotYet();
        }

        uint256 _daysPastRewardRate = (totalDaysPast *
            stakeToHarvest.rewardRatio) / (stakeToHarvest.rate);

        uint256 stakeRewardAmount = (stakeToHarvest.amount *
            _daysPastRewardRate) / PERCENT_DIVIDER;

        if (stakePlusAddress[stakeToHarvest.user] > 0) {
            stakePlusReward =
                (stakeToHarvest.amount * stakePlus) /
                PERCENT_DIVIDER;
        }

        stakeRewardAmount += stakePlusReward;

        if (stakeRewardAmount == 0) {
            revert ZeroRewardHarvest();
        }

        if (totalRewardsLeft < stakeRewardAmount) {
            stakeRewardAmount = totalRewardsLeft;
        }

        return stakeRewardAmount;
    }

    // @dev user can exit from pool when stake finish
    function exit(uint16 id) external nonReentrant onlyEOA onlyStakesExist {
        Stake memory stakeToExit = stakedToken[id];

        if (stakeToExit.isActive == 0) {
            revert StakeIsNotActive();
        }

        if (msg.sender != stakeToExit.user) {
            revert NotYourToken();
        }

        if (block.timestamp < stakeToExit.since + (stakeToExit.rate * 1 days)) {
            revert TimeNotYet();
        }

        stakedToken[id].isActive = 0;

        uint256 stakeAndReward = _exit(stakeToExit);

        emit Exited(stakeToExit.user, stakeAndReward);
        require(
            dimentDollar.transfer(stakeToExit.user, stakeAndReward),
            "Transfer Error"
        );
    }

    // @dev exit internal
    function _exit(Stake memory stakeToExit) internal returns (uint256) {
        uint256 stakeAmount = stakeToExit.amount;
        uint256 rewardAmount = (stakeToExit.rewardRatio * stakeAmount) /
            PERCENT_DIVIDER;

        totalStakedAmount -= stakeAmount;
        totalStakesByRate[stakeToExit.rate] -= stakeAmount;

        // total rewards claim update
        totalRewardsLeft -= rewardAmount;
        // total rewards given update
        totalStakeRewardClaimed += rewardAmount;

        return stakeAmount + rewardAmount;
    }

    // @dev user can withdraw before time finish but should pay fee
    function emergencyWithdraw(
        uint16 id
    ) external nonReentrant onlyEOA onlyStakesExist {
        Stake memory stakeToExit = stakedToken[id];

        if (msg.sender != stakeToExit.user) {
            revert NotYourToken();
        }

        if (stakeToExit.isActive == 0) {
            revert StakeIsNotActive();
        }

        if (stakeToExit.rate > maxEmergencyWithdrawRate) {
            revert CannotExitThisStake();
        }

        // to not use storage
        uint256 _stakedTokenAmount = stakeToExit.amount;

        if (dimentDollar.balanceOf(address(this)) < _stakedTokenAmount) {
            revert ContractBalanceNotEnough();
        }

        stakedToken[id].isActive = 0;

        totalStakedAmount -= _stakedTokenAmount;

        totalStakesByRate[stakeToExit.rate] -= _stakedTokenAmount;

        // no rewards for user
        // we shouldupdate reward amount with exited not rewarded stake details
        uint256 rewardAmount = (stakeToExit.rewardRatio * stakeToExit.amount) /
            PERCENT_DIVIDER;
        totalRewardsLeft += rewardAmount;

        uint256 feeAmount = 0;

        if (emergencyFee > 0) {
            feeAmount = (_stakedTokenAmount * emergencyFee) / PERCENT_DIVIDER;
            // send fee to fee address
            require(
                dimentDollar.transfer(stakeFeeAddress, feeAmount),
                "Fee Transfer Error"
            );
        }

        emit EmergenyWithdrawed(msg.sender, _stakedTokenAmount);
        uint256 afterFee = _stakedTokenAmount - feeAmount;
        // send balance after fee staked tokens to user
        require(dimentDollar.transfer(msg.sender, afterFee), "Transfer Error");
    }

    // @dev easy for frontend all ids
    function getAddressAllStakeIds(
        address wallet
    ) external view returns (uint16[] memory) {
        return stakesByAddress[wallet];
    }

    // @dev easy for frontend stake details
    function getSingleStakeDetails(
        uint16 id
    )
        external
        view
        returns (
            address user,
            uint256 amount,
            uint256 since,
            uint32 rewardRatio,
            uint32 rate,
            uint8 isActive
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
        uint16[] memory userStakes = stakesByAddress[wallet];

        uint256 totalStaked = 0;
        for (uint256 i = 0; i < userStakes.length; i++) {
            if (stakedToken[userStakes[i]].isActive == 1) {
                totalStaked += stakedToken[userStakes[i]].amount;
            }
        }
        return totalStaked;
    }

    // stakedekileri koruyacak
    function removeRewardsFromContract(
        address to,
        uint256 amount
    )
        public
        nonReentrant // nonReentrant modifier added
        onlyOwner
    {
        uint256 _contractBalance = dimentDollar.balanceOf(address(this));
        uint256 _afterBalance = _contractBalance -
            (totalStakedAmount + totalRewardsLeft);

        if (amount > _afterBalance) {
            amount = _afterBalance;
        }

        emit RewardsFromContract(amount); // event emitted before the external call

        require(dimentDollar.transfer(to, amount), "Reward transfer error");
    }

    // use this function to add rewards to contract
    function addRewardsToContract(uint256 amount) public nonReentrant {
        if (amount == 0) {
            revert CanNotAddZero();
        }

        emit RewardsAddedToContract(amount);
        require(
            dimentDollar.transferFrom(msg.sender, address(this), amount),
            "Transfer Error"
        );
        totalRewardsLeft += amount;
    }
}
