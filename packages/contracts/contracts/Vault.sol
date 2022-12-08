//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.5;
pragma abicoder v2;

import "./interfaces/IVault.sol";
import "./interfaces/IWallet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

import "hardhat/console.sol";

contract Vault is IVault, IERC721Receiver, IERC1155Receiver {
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    address public wallet;

    modifier onlyTeller() {
        require(msg.sender == wallet, "Not called from Teller");
        _;
    }

    // TODO: deployment can be front run
    function initialize(address _teller) external {
        require(wallet == address(0), "Vault already initialized");
        wallet = _teller;
    }

    function requestERC20s(
        address[] calldata _assetAddress,
        uint256[] calldata _values
    ) external override onlyTeller {
        require(
            _values.length == _assetAddress.length,
            "Non matching input array lengths"
        );
        for (uint256 i = 0; i < _values.length; i++) {
            if (_values[i] != 0) {
                require(
                    IERC20(_assetAddress[i]).transfer(wallet, _values[i]),
                    "Transfer failed"
                );
            }
        }
    }

    function requestERC721(
        address _assetAddress,
        uint256 _id
    ) external override onlyTeller {
        IERC721(_assetAddress).safeTransferFrom(address(this), wallet, _id);
    }

    function requestERC1155(
        address _assetAddress,
        uint256 _id,
        uint256 _value
    ) external override onlyTeller {
        IERC1155(_assetAddress).safeTransferFrom(
            address(this),
            wallet,
            _id,
            _value,
            ""
        );
    }

    function approveFunds(
        uint256[] calldata _values,
        address[] calldata _assets
    ) external override onlyTeller {
        require(
            _values.length == _assets.length,
            "Non matching input array lengths"
        );
        for (uint256 i = 0; i < _values.length; i++) {
            require(
                IERC20(_assets[i]).approve(wallet, _values[i]),
                "Approval failed"
            );
        }
    }

    // TODO: alter array length in memory, so that we don't have to return the array length
    function makeBatchDeposit(
        IWallet.Deposit[] calldata _deposits,
        uint256 _numApprovedDeposits
    ) external override onlyTeller returns (uint256[] memory, uint256) {
        uint256[] memory _successfulTransfers = new uint256[](
            _numApprovedDeposits
        );
        uint256 _numSuccessfulTransfers = 0;
        for (uint256 i = 0; i < _numApprovedDeposits; i++) {
            if (makeDeposit(_deposits[i])) {
                _successfulTransfers[_numSuccessfulTransfers] = i;
                _numSuccessfulTransfers++;
            }
        }

        return (_successfulTransfers, _numSuccessfulTransfers);
    }

    function makeDeposit(
        IWallet.Deposit calldata _deposit
    ) public override onlyTeller returns (bool) {
        if (_deposit.id == SNARK_SCALAR_FIELD - 1) {
            return
                IERC20(_deposit.asset).transferFrom(
                    _deposit.spender,
                    address(this),
                    _deposit.value
                );
        } else if (_deposit.value == 0) {
            try
                IERC721(_deposit.asset).transferFrom(
                    _deposit.spender,
                    address(this),
                    _deposit.id
                )
            {
                return true;
            } catch {
                return false;
            }
        } else {
            try
                IERC1155(_deposit.asset).safeTransferFrom(
                    _deposit.spender,
                    address(this),
                    _deposit.id,
                    _deposit.value,
                    ""
                )
            {
                return true;
            } catch {
                return false;
            }
        }
    }

    function onERC721Received(
        address, // operator
        address, // from
        uint256, // tokenId
        bytes calldata // data
    ) external override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function onERC1155Received(
        address, // operator
        address, // from
        uint256, // id
        uint256, // value
        bytes calldata // data
    ) external override returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address, // operator
        address, // from
        uint256[] calldata, // ids
        uint256[] calldata, // values
        bytes calldata // data
    ) external override returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    // TODO: fix this
    function supportsInterface(
        bytes4 // interfaceId
    ) external view override returns (bool) {
        return false;
    }
}
