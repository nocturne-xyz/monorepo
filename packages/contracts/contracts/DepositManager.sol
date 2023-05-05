// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// External
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
// Internal
import {ITeller} from "./interfaces/ITeller.sol";
import {IWeth} from "./interfaces/IWeth.sol";
import {DepositManagerBase} from "./DepositManagerBase.sol";
import {AssetUtils} from "./libs/AssetUtils.sol";
import {Utils} from "./libs/Utils.sol";
import "./libs/Types.sol";

contract DepositManager is
    DepositManagerBase,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable
{
    struct Erc20Cap {
        uint128 runningGlobalDeposited; // total deposited for asset over last 1h (in precision units), note that uint128 is plenty large (3x10^20 whole tokens even for 18 decimal tokens)
        uint32 globalCapWholeTokens; // global cap for asset in whole tokens
        uint32 maxPerAddressDepositSize; // max size of a single deposit per address
        uint32 lastResetTimestamp; // block.timestamp of last reset (limit at year 2106)
        uint8 precision; // decimals for asset
    }

    uint256 constant ERC20_ID = 0;
    uint256 constant TWO_ETH_TRANSFERS_GAS = 50_000;
    uint256 constant SECONDS_IN_HOUR = 3_600;

    ITeller public _teller;
    IWeth public _weth;

    EncodedAsset public _wethEncoded;

    mapping(address => bool) public _screeners;
    mapping(address => uint256) public _nonces;
    mapping(bytes32 => bool) public _outstandingDepositHashes;

    mapping(address => Erc20Cap) public _erc20Caps;

    // gap for upgrade safety
    uint256[50] private __GAP;

    event ScreenerPermissionSet(address screener, bool permission);

    event DepositInstantiated(
        address indexed spender,
        EncodedAsset encodedAsset,
        uint256 value,
        StealthAddress depositAddr,
        uint256 nonce,
        uint256 gasCompensation
    );

    event DepositRetrieved(
        address indexed spender,
        EncodedAsset encodedAsset,
        uint256 value,
        StealthAddress depositAddr,
        uint256 nonce,
        uint256 gasCompensation
    );

    event DepositCompleted(
        address indexed spender,
        EncodedAsset encodedAsset,
        uint256 value,
        StealthAddress depositAddr,
        uint256 nonce,
        uint256 gasCompensation
    );

    function initialize(
        string memory contractName,
        string memory contractVersion,
        address teller,
        address weth
    ) external initializer {
        __Ownable_init();
        __DepositManagerBase_init(contractName, contractVersion);
        _teller = ITeller(teller);
        _weth = IWeth(weth);
        _wethEncoded = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(_weth),
            ERC20_ID
        );
    }

    modifier enforceErc20Cap(address token, uint256 value) {
        require(value < type(uint128).max, "value >= uint128.max");

        Erc20Cap memory cap = _erc20Caps[token];

        // Ensure asset is supported (has a cap)
        require(
            (cap.runningGlobalDeposited |
                cap.globalCapWholeTokens |
                cap.maxPerAddressDepositSize |
                cap.lastResetTimestamp |
                cap.precision) != 0,
            "!supported erc20"
        );

        // Clear expired global cap if possible
        if (block.timestamp > cap.lastResetTimestamp + SECONDS_IN_HOUR) {
            cap.runningGlobalDeposited = 0;
            cap.lastResetTimestamp = uint32(block.timestamp);
        }

        uint256 precision = (10 ** cap.precision);
        uint256 globalCap = cap.globalCapWholeTokens * precision;
        uint256 perAddressDepositSizeCap = cap.maxPerAddressDepositSize *
            precision;

        // Ensure less than global cap and less than deposit size cap
        require(
            uint256(cap.runningGlobalDeposited) + value <= globalCap,
            "globalCap exceeded"
        );
        require(
            uint256(value) <= perAddressDepositSizeCap,
            "perAddressDepositSizeCap exceeded"
        );

        _;

        // we know value < uint128.max given first require
        _erc20Caps[token].runningGlobalDeposited += uint128(value);
    }

    function setScreenerPermission(
        address screener,
        bool permission
    ) external onlyOwner {
        _screeners[screener] = permission;
        emit ScreenerPermissionSet(screener, permission);
    }

    function setErc20Cap(
        address token,
        uint32 globalCapWholeTokens,
        uint32 maxPerAddressDepositSize,
        uint8 precision
    ) external onlyOwner {
        _erc20Caps[token] = Erc20Cap({
            runningGlobalDeposited: 0,
            globalCapWholeTokens: globalCapWholeTokens,
            maxPerAddressDepositSize: maxPerAddressDepositSize,
            lastResetTimestamp: uint32(block.timestamp),
            precision: precision
        });
    }

    function instantiateETHDeposit(
        uint256 value,
        StealthAddress calldata depositAddr
    ) external payable enforceErc20Cap(address(_weth), value) nonReentrant {
        require(msg.value >= value, "msg.value < value");
        _weth.deposit{value: value}();

        DepositRequest memory req = DepositRequest({
            spender: msg.sender,
            encodedAsset: _wethEncoded,
            value: value,
            depositAddr: depositAddr,
            nonce: _nonces[msg.sender],
            gasCompensation: msg.value - value
        });

        bytes32 depositHash = _hashDepositRequest(req);

        // Update deposit mapping and nonces
        _outstandingDepositHashes[depositHash] = true;
        _nonces[req.spender] = req.nonce + 1;

        emit DepositInstantiated(
            req.spender,
            req.encodedAsset,
            req.value,
            req.depositAddr,
            req.nonce,
            req.gasCompensation
        );
    }

    function instantiateErc20Deposit(
        address token,
        uint256 value,
        StealthAddress calldata depositAddr
    ) external payable nonReentrant enforceErc20Cap(token, value) {
        EncodedAsset memory encodedAsset = AssetUtils.encodeAsset(
            AssetType.ERC20,
            token,
            ERC20_ID
        );
        _instantiateDeposit(encodedAsset, value, depositAddr);
    }

    function _instantiateDeposit(
        EncodedAsset memory encodedAsset,
        uint256 value,
        StealthAddress calldata depositAddr
    ) internal {
        DepositRequest memory req = DepositRequest({
            spender: msg.sender,
            encodedAsset: encodedAsset,
            value: value,
            depositAddr: depositAddr,
            nonce: _nonces[msg.sender],
            gasCompensation: msg.value
        });

        bytes32 depositHash = _hashDepositRequest(req);

        // Update deposit mapping and nonces
        _outstandingDepositHashes[depositHash] = true;
        _nonces[req.spender] = req.nonce + 1;

        AssetUtils.transferAssetFrom(req.encodedAsset, req.spender, req.value);

        emit DepositInstantiated(
            req.spender,
            req.encodedAsset,
            req.value,
            req.depositAddr,
            req.nonce,
            req.gasCompensation
        );
    }

    // NOTE: We accept race condition where user could technically retrieve their deposit before
    // the screener completes it. This would grief the screener but would incur a greater cost to
    // the user to continually instantiate + prematurely retrieve.
    function retrieveDeposit(
        DepositRequest calldata req
    ) external nonReentrant {
        require(msg.sender == req.spender, "Only spender can retrieve deposit");

        // If _outstandingDepositHashes has request, implies all checks (e.g.
        // chainId, nonce, etc) already passed upon instantiation
        bytes32 depositHash = _hashDepositRequest(req);
        require(_outstandingDepositHashes[depositHash], "deposit !exists");

        // Clear deposit hash
        _outstandingDepositHashes[depositHash] = false;

        // Send back asset
        AssetUtils.transferAssetTo(req.encodedAsset, req.spender, req.value);

        // Send back eth gas compensation, revert propagated
        AddressUpgradeable.sendValue(payable(msg.sender), req.gasCompensation);

        emit DepositRetrieved(
            req.spender,
            req.encodedAsset,
            req.value,
            req.depositAddr,
            req.nonce,
            req.gasCompensation
        );
    }

    function completeDeposit(
        DepositRequest calldata req,
        bytes calldata signature
    ) external nonReentrant {
        uint256 preDepositGas = gasleft();

        // Recover and check screener signature
        address recoveredSigner = _recoverDepositRequestSigner(req, signature);
        require(_screeners[recoveredSigner], "request signer !screener");

        // If _outstandingDepositHashes has request, implies all checks (e.g.
        // chainId, nonce, etc) already passed upon instantiation
        bytes32 depositHash = _hashDepositRequest(req);
        require(_outstandingDepositHashes[depositHash], "deposit !exists");

        // Clear deposit hash
        _outstandingDepositHashes[depositHash] = false;

        // Approve teller for assets and deposit funds
        AssetUtils.approveAsset(req.encodedAsset, address(_teller), req.value);
        _teller.depositFunds(req);

        // NOTE: screener may be under-compensated for gas during spikes in
        // demand.
        // NOTE: only case where screener takes more gas than it actually spent
        // is when gasComp exactly equals req.gasCompensation (can ignore edge
        // case and not over complicate logic)
        uint256 gasComp = preDepositGas - gasleft() + TWO_ETH_TRANSFERS_GAS;
        uint256 actualGasComp = Utils.min(
            gasComp * tx.gasprice,
            req.gasCompensation
        );
        if (actualGasComp > 0) {
            // Revert propagated
            AddressUpgradeable.sendValue(payable(msg.sender), actualGasComp);
        }

        // Send back any remaining eth to user
        uint256 remainingGasComp = req.gasCompensation - actualGasComp;
        if (remainingGasComp > 0) {
            // Revert propagated
            AddressUpgradeable.sendValue(
                payable(req.spender),
                remainingGasComp
            );
        }

        emit DepositCompleted(
            req.spender,
            req.encodedAsset,
            req.value,
            req.depositAddr,
            req.nonce,
            req.gasCompensation
        );
    }
}
