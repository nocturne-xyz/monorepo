// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IWallet} from "./interfaces/IWallet.sol";
import {DepositManagerBase} from "./DepositManagerBase.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./libs/Types.sol";
import "./libs/AssetUtils.sol";
import "./libs/Utils.sol";

contract DepositManager is
    DepositManagerBase,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable
{
    IWallet public _wallet;
    address public _vault;
    mapping(address => bool) public _screeners;
    mapping(address => uint256) public _nonces;
    mapping(bytes32 => bool) public _outstandingDepositHashes;

    event ScreenerPermissionSet(address screener, bool permission);

    event DepositInstantiated(
        uint256 indexed chainId,
        address indexed spender,
        EncodedAsset encodedAsset,
        uint256 value,
        StealthAddress depositAddr,
        uint256 nonce,
        uint256 gasCompensation
    );

    event DepositRetrieved(
        uint256 indexed chainId,
        address indexed spender,
        EncodedAsset encodedAsset,
        uint256 value,
        StealthAddress depositAddr,
        uint256 nonce,
        uint256 gasCompensation
    );

    event DepositCompleted(
        uint256 indexed chainId,
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
        address wallet,
        address vault
    ) external initializer {
        __Ownable_init();
        __DepositManagerBase_init(contractName, contractVersion);
        _wallet = IWallet(wallet);
        _vault = vault;
    }

    function setScreenerPermission(
        address screener,
        bool permission
    ) external onlyOwner {
        _screeners[screener] = permission;
        emit ScreenerPermissionSet(screener, permission);
    }

    function instantiateDeposit(
        DepositRequest calldata req
    ) external payable nonReentrant {
        require(req.chainId == block.chainid, "Wrong chainId");
        require(msg.sender == req.spender, "Only spender can start deposit");
        require(req.nonce == _nonces[req.spender], "Invalid nonce");
        require(
            msg.value == req.gasCompensation,
            "msg.value != req.gasCompensation"
        );

        bytes32 depositHash = _hashDepositRequest(req);

        // Update deposit mapping and nonces
        _outstandingDepositHashes[depositHash] = true;
        _nonces[req.spender] = req.nonce + 1;

        AssetUtils.transferAssetFrom(req.encodedAsset, req.spender, req.value);

        emit DepositInstantiated(
            req.chainId,
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
            req.chainId,
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

        // Approve vault for assets and deposit funds
        AssetUtils.approveAsset(req.encodedAsset, _vault, req.value);
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
            req.chainId,
            req.spender,
            req.encodedAsset,
            req.value,
            req.depositAddr,
            req.nonce,
            req.gasCompensation
        );
    }
}
