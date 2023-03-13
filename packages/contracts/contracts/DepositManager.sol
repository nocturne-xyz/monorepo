// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IWallet} from "./interfaces/IWallet.sol";
import {DepositManagerBase} from "./DepositManagerBase.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./libs/Types.sol";
import "./libs/AssetUtils.sol";
import "./libs/Utils.sol";

contract DepositManager is DepositManagerBase, ReentrancyGuardUpgradeable {
    IWallet public _wallet;
    mapping(address => bool) public _screeners;
    mapping(address => uint256) public _nonces;
    mapping(address => uint256) public _gasTankBalances;
    mapping(uint256 => bool) public _outstandingDepositHashes;

    event DepositInstantiated(
        address indexed spender,
        EncodedAsset indexed encodedAsset,
        uint256 value,
        uint256 nonce
    );

    event DepositRetrieved(
        address indexed spender,
        EncodedAsset indexed encodedAsset,
        uint256 value,
        uint256 nonce
    );

    event DepositProcessed(
        address indexed spender,
        EncodedAsset indexed encodedAsset,
        uint256 value,
        uint256 nonce,
        string failureReason
    );

    function initialize(
        string memory contractName,
        string memory contractVersion,
        address wallet
    ) external initializer {
        __DepositManagerBase_initialize(contractName, contractVersion);
        _wallet = IWallet(wallet);
    }

    function instantiateDeposit(
        DepositRequest calldata req
    ) external payable nonReentrant {
        require(req.chainId == block.chainid, "Wrong chainId");
        require(msg.sender == req.spender, "Only spender can start deposit");
        require(req.nonce == _nonces[req.spender], "Invalid nonce");

        uint256 depositHash = uint256(_hashDepositRequest(req));
        require(
            !_outstandingDepositHashes[depositHash],
            "Deposit request already submitted"
        );

        // Update gas tank
        _gasTankBalances[msg.sender] += msg.value;

        // Update deposit mapping and nonces
        _outstandingDepositHashes[depositHash] = true;
        _nonces[req.spender] = req.nonce + 1;

        AssetUtils.transferAssetFrom(req.encodedAsset, req.spender, req.value);

        emit DepositInstantiated(
            req.spender,
            req.encodedAsset,
            req.value,
            req.nonce
        );
    }

    function retrieveDeposit(
        DepositRequest calldata req
    ) external nonReentrant {
        require(req.chainId == block.chainid, "Wrong chainId");
        require(msg.sender == req.spender, "Only spender can retrieve deposit");

        uint256 depositHash = uint256(_hashDepositRequest(req));
        require(
            _outstandingDepositHashes[depositHash],
            "Cannot retrieve nonexistent deposit"
        );

        _outstandingDepositHashes[depositHash] = false;

        AssetUtils.transferAssetTo(req.encodedAsset, req.spender, req.value);

        emit DepositRetrieved(
            req.spender,
            req.encodedAsset,
            req.value,
            req.nonce
        );
    }

    function processDeposit(
        DepositRequest calldata req,
        bytes calldata signature
    ) external nonReentrant {
        uint256 preDepositGas = gasleft();

        // If failure at deposit screen verification, depositor loses gas funds
        require(req.chainId == block.chainid, "Wrong chainId");
        require(
            msg.sender == req.spender,
            "Only spender can instantiate deposit"
        );
        require(req.nonce == _nonces[req.spender], "Invalid nonce");

        address recovered = _recoverDepositRequestSig(req, signature);
        require(_screeners[recovered], "!screener sig");

        uint256 depositHash = uint256(_hashDepositRequest(req));
        require(
            _outstandingDepositHashes[depositHash],
            "Cannot retrieve nonexistent deposit"
        );
        _outstandingDepositHashes[depositHash] = false;

        // If failure in depositFunds (e.g. revoked approval), user still
        // pays gas
        string memory failureReason = "";
        try _wallet.depositFunds(req) {
            // If success, do nothing
        } catch (bytes memory reason) {
            failureReason = Utils.getRevertMsg(reason);
        }

        uint256 postDepositGas = preDepositGas - gasleft();
        uint256 gasToTransfer = postDepositGas * req.gasPrice;

        uint256 actualGas = Utils.min(
            gasToTransfer,
            _gasTankBalances[req.spender]
        );
        _gasTankBalances[req.spender] -= actualGas; // before transfer to avoid reentrancy

        (bool success, ) = msg.sender.call{value: actualGas}("");
        require(success, "Failed to send eth to screener");

        emit DepositProcessed(
            req.spender,
            req.encodedAsset,
            req.value,
            req.nonce,
            failureReason
        );
    }
}
