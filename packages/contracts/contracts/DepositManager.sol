// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// External
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
// Internal
import {IWallet} from "./interfaces/IWallet.sol";
import {DepositManagerBase} from "./DepositManagerBase.sol";
import {AssetUtils} from "./libs/AssetUtils.sol";
import {Utils} from "./libs/Utils.sol";
import "./libs/Types.sol";

contract DepositManager is
    DepositManagerBase,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable
{
    IWallet public _wallet;
    mapping(address => bool) public _screeners;
    mapping(address => uint256) public _nonces;
    mapping(bytes32 => bool) public _outstandingDepositHashes;

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
        address wallet
    ) external initializer {
        __Ownable_init();
        __DepositManagerBase_init(contractName, contractVersion);
        _wallet = IWallet(wallet);
    }

    function setScreenerPermission(
        address screener,
        bool permission
    ) external onlyOwner {
        _screeners[screener] = permission;
        emit ScreenerPermissionSet(screener, permission);
    }

    function instantiateDeposit(
        EncodedAsset calldata encodedAsset,
        uint256 value,
        StealthAddress calldata depositAddr
    ) external payable nonReentrant {
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

    function retrieveDeposit(
        DepositRequest calldata req
    ) external nonReentrant {
        require(msg.sender == req.spender, "Only spender can retrieve deposit");

        // If _outstandingDepositHashes has request, implies all checks (e.g.
        // chainId, nonce, etc) already passed upon instantiation
        // TODO: invariant check this condition
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

        // If _outstandingDepositHashes has request, implies all checks (e.g.
        // chainId, nonce, etc) already passed upon instantiation
        // TODO: invariant check this condition
        bytes32 depositHash = _hashDepositRequest(req);
        require(_outstandingDepositHashes[depositHash], "deposit !exists");

        // Recover and check screener signature
        address recoveredSigner = _recoverDepositRequestSigner(req, signature);
        require(_screeners[recoveredSigner], "request signer !screener");

        // Approve wallet for assets and deposit funds
        AssetUtils.approveAsset(req.encodedAsset, address(_wallet), req.value);
        _wallet.depositFunds(req);

        // NOTE: screener may be under-compensated for gas during spikes in
        // demand
        uint256 gasUsed = preDepositGas - gasleft();
        uint256 actualGasComp = Utils.min(
            gasUsed * tx.gasprice,
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
