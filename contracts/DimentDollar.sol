// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

/**
 * The Diment Dollar is an outstanding digital product that redefines the concept of value-security
 * in the financial world by reinventing the present Stablecoin model.
 * As the first Stablecoin with a fixed price of 1 USD and a token supply fully backed by the underlying diamond reserve value in USD,
 * Diment Dollar operates in a reverse mode compared to present Stablecoins by creating value first.
 */

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract DimentDollar is
    Initializable,
    ERC20PermitUpgradeable,
    OwnableUpgradeable
{
    /**
     * @dev Defines events emitted by the contract to capture specific occurrences or state changes.
     * These events provide insight into the contract's behavior and can be used for external monitoring.
     */
    event Mint(address indexed destination, uint256 amount);
    event Redeem(uint256 amount);

    event Blacklisted(address indexed wallet);
    event UnBlacklisted(address indexed wallet);
    event DestroyedBlockedFunds(
        address indexed blacklistedUser,
        uint256 balance
    );

    uint8 internal ddDecimal;

    /**
     * @dev Mapping of users identified as blacklisted, indicating restricted access or functionality.
     */
    mapping(address => bool) public isBlacklisted;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract with specified parameters to set its initial state.
     *
     * @param name_ The name of the token.
     * @param symbol_ The symbol of the token.
     * @param decimal_ The decimal precision of the token.
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        uint8 decimal_
    ) external initializer {
        ddDecimal = decimal_;
        __Ownable_init(_msgSender());
        __ERC20_init(name_, symbol_);
        __ERC20Permit_init(name_);
    }

    /**
     * @dev Verify whether an account is on the blacklist.
     */
    modifier onlyNotBlacklisted() {
        if (isBlacklisted[_msgSender()]) {
            revert WalletBlacklisted(_msgSender());
        }
        _;
    }

    /**
     * @dev Retrieves the number of decimals used by the token.
     *
     * @return The number of decimals for the token.
     */
    function decimals() public view virtual override returns (uint8) {
        return ddDecimal;
    }

    /**
     * @dev Transfers a specified amount of funds from the sender's account to the designated recipient.
     *
     * @param recipient_ The address of the recipient to receive the funds.
     * @param amount_ The amount of funds to be transferred.
     * @return A boolean indicating the success of the fund transfer.
     */
    function transfer(
        address recipient_,
        uint256 amount_
    ) public virtual override onlyNotBlacklisted returns (bool) {
        if (recipient_ == address(this)) {
            revert TransferToContract();
        }
        if (isBlacklisted[recipient_]) {
            revert WalletBlacklisted(recipient_);
        }

        return super.transfer(recipient_, amount_);
    }

    /**
     * @dev Facilitates straightforward multi-transfer functionality, allowing a maximum of 50 recipients.
     *
     * @param recipients_ The array of recipients intended for the transfer operation.
     * @param amounts_ The array specifying the amounts to be transferred.
     */
    function multiTransfer(
        address[] memory recipients_,
        uint256[] memory amounts_
    ) external onlyNotBlacklisted {
        uint256 arrLength = amounts_.length;

        if (arrLength != recipients_.length) {
            revert LengthMismatch(recipients_.length, arrLength);
        }
        if (arrLength > 50) {
            revert MoreThenLimit();
        }

        for (uint8 i = 0; i < arrLength; i++) {
            transfer(recipients_[i], amounts_[i]);
        }
    }

    /**
     * @dev Transfers funds from the specified sender's account to the designated recipient using an allowance.
     *
     * @param owner_ The address allowing the transfer.
     * @param recipient_ The address of the recipient to receive the funds.
     * @param amount_ The amount of funds to be transferred.
     * @return A boolean indicating the success of the fund transfer.
     */
    function transferFrom(
        address owner_,
        address recipient_,
        uint256 amount_
    ) public virtual override onlyNotBlacklisted returns (bool) {
        if (recipient_ == address(this)) {
            revert TransferToContract();
        }
        if (isBlacklisted[owner_]) {
            revert WalletBlacklisted(owner_);
        }
        if (isBlacklisted[recipient_]) {
            revert WalletBlacklisted(recipient_);
        }

        return super.transferFrom(owner_, recipient_, amount_);
    }

    /**
     * @dev Generate and create new tokens through the minting process.
     *
     * @param recipient_ The designated recipient who will receive these funds.
     * @param amount_ The specified amount of value intended for the transfer operation.
     */
    function mint(address recipient_, uint256 amount_) external onlyOwner {
        if (isBlacklisted[recipient_]) {
            revert WalletBlacklisted(recipient_);
        }
        _mint(recipient_, amount_);
        emit Mint(recipient_, amount_);
    }

    /**
     * @dev Burns a specified amount of funds from the owner's wallet, reducing the total supply.
     *
     * @param amount_ The amount of funds to be burned.
     */
    function redeem(uint256 amount_) external onlyOwner {
        _burn(owner(), amount_);
        emit Redeem(amount_);
    }

    /**
     * @dev Adds a user to the blacklist, restricting their access to certain functionalities.
     *
     * @param user_ The address of the user to be added to the blacklist.
     */
    function addToBlacklist(address user_) external onlyOwner {
        isBlacklisted[user_] = true;
        emit Blacklisted(user_);
    }

    /**
     * @dev Removes a user from the blacklist, restoring their access to functionalities.
     *
     * @param user_ The address of the user to be removed from the blacklist.
     */
    function removeFromBlacklist(address user_) external onlyOwner {
        isBlacklisted[user_] = false;
        emit UnBlacklisted(user_);
    }

    /**
     * @dev Burns the all funds associated with a blacklisted account, reducing the total token supply.
     *
     * @param blacklistedUser_ The address of the blacklisted account whose funds will be burned.
     */
    function destroyBlockedFunds(address blacklistedUser_) external onlyOwner {
        if (!isBlacklisted[blacklistedUser_]) {
            revert OnlyBlacklisted(blacklistedUser_);
        }
        uint blockedFunds = balanceOf(blacklistedUser_);
        _burn(blacklistedUser_, blockedFunds);
        emit DestroyedBlockedFunds(blacklistedUser_, blockedFunds);
    }
}

/**
 * @dev Defines custom error messages that may be thrown during the execution of the contract.
 * These errors provide information about exceptional conditions and can be caught or used for debugging.
 */
error TransferToContract();
error MoreThenLimit();
error LengthMismatch(uint recipients, uint amounts);
error WalletBlacklisted(address user);
error OnlyBlacklisted(address user);
