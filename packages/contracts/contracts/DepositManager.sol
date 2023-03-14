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
    address public _vault;
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
        uint256 nonce
    );

    function initialize(
        string memory contractName,
        string memory contractVersion,
        address wallet,
        address vault
    ) external initializer {
        __DepositManagerBase_initialize(contractName, contractVersion);
        _wallet = IWallet(wallet);
        _vault = vault;
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
        require(msg.sender == req.spender, "Only spender can retrieve deposit");

        // If _outstandingDepositHashes has request, implies all checks (e.g.
        // chainId, nonce, etc) already passed upon instantiation
        uint256 depositHash = uint256(_hashDepositRequest(req));
        require(
            _outstandingDepositHashes[depositHash],
            "Cannot retrieve nonexistent deposit"
        );

        // Update deposit hashes and escrow assets in contract
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

        // If _outstandingDepositHashes has request, implies all checks (e.g.
        // chainId, nonce, etc) already passed upon instantiation
        uint256 depositHash = uint256(_hashDepositRequest(req));
        require(
            _outstandingDepositHashes[depositHash],
            "Cannot retrieve nonexistent deposit"
        );

        // Recover and check screener signature
        address recovered = _recoverDepositRequestSig(req, signature);
        require(_screeners[recovered], "!screener sig");

        // Approve vault for assets and deposit funds
        AssetUtils.approveAsset(req.encodedAsset, _vault, req.value);
        _wallet.depositFunds(req);

        // Compensate screener for gas
        // TODO: should users be able to withdraw ETH from gas tank?
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
            req.nonce
        );
    }
}
