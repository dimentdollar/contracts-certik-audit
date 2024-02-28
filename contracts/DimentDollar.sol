// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

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
    event DestroyedBlockedFunds(
        address indexed blacklistedUser,
        uint256 balance
    );
    event Blacklisted(address indexed wallet);
    event UnBlacklisted(address indexed wallet);

    /**
     * @dev Mapping of users identified as blacklisted, indicating restricted access or functionality.
     */
    mapping(address => bool) public isBlacklisted;

    uint8 internal ddDecimal;

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
     * @param mscontract_ The address of the multi-signature wallet contract.
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        uint8 decimal_,
        address mscontract_
    ) external initializer {
        ddDecimal = decimal_;
        __Ownable_init(mscontract_);
        __ERC20_init(name_, symbol_);
        __ERC20Permit_init(name_);
    }

    /**
     * @dev Verify whether an account is on the blacklist.
     */
    modifier onlyNotBlacklisted() {
        if (isBlacklisted[_msgSender()]) {
            revert BlacklistedAccount(_msgSender());
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
     * @dev Facilitates straightforward multi-transfer functionality, allowing a maximum of 50 recipients.
     *
     * @param recipients_ The array of recipients intended for the transfer operation.
     * @param amounts_ The array specifying the amounts to be transferred.
     */
    function multiTransfer(
        address[] memory recipients_,
        uint256[] memory amounts_
    ) external onlyNotBlacklisted {
        if (recipients_.length > 50) {
            revert MoreThenLimit();
        }
        if (recipients_.length != amounts_.length) {
            revert LengthMismatch(recipients_.length, amounts_.length);
        }

        uint256 totalSend = 0;
        uint256 _balance = super.balanceOf(_msgSender());

        for (uint8 i = 0; i < amounts_.length; i++) {
            totalSend = totalSend + amounts_[i];
        }
        if (_balance < totalSend) {
            revert NotEnoughTokens();
        }

        for (uint8 i = 0; i < recipients_.length; i++) {
            transfer(recipients_[i], amounts_[i]);
        }
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

    /**
     * @dev Adds a user to the blacklist, restricting their access to certain functionalities.
     *
     * @param user_ The address of the user to be added to the blacklist.
     * @return A boolean indicating the success of adding the user to the blacklist.
     */
    function addToBlacklist(address user_) external onlyOwner returns (bool) {
        isBlacklisted[user_] = true;
        emit Blacklisted(user_);
        return true;
    }

    /**
     * @dev Removes a user from the blacklist, restoring their access to functionalities.
     *
     * @param user_ The address of the user to be removed from the blacklist.
     * @return A boolean indicating the success of removing the user from the blacklist.
     */
    function removeFromBlacklist(
        address user_
    ) external onlyOwner returns (bool) {
        isBlacklisted[user_] = false;
        emit UnBlacklisted(user_);
        return true;
    }
}

/**
 * @dev Defines custom error messages that may be thrown during the execution of the contract.
 * These errors provide information about exceptional conditions and can be caught or used for debugging.
 */
error BlacklistedAccount(address user);
error TransferToContract();
error WalletBlacklisted(address user);
error MoreThenLimit();
error LengthMismatch(uint recipients, uint amounts);
error NotEnoughTokens();
error OnlyBlacklisted(address user);
