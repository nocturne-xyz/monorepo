// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
pragma abicoder v2;

import "./CommitmentTreeManager.sol";
import {IVault} from "./interfaces/IVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {Utils} from "./libs/Utils.sol";
import "./libs/types.sol";

contract BalanceManager is
    IERC721Receiver,
    IERC1155Receiver,
    CommitmentTreeManager
{
    EncodedAsset[] _receivedTokens;
    IVault public immutable _vault;

    constructor(
        address vault,
        address joinSplitVerifier,
        address _subtreeUpdateVerifier
    ) CommitmentTreeManager(joinSplitVerifier, _subtreeUpdateVerifier) {
        _vault = IVault(vault);
    }

    function onERC721Received(
        address, // operator
        address, // from
        uint256 id,
        bytes calldata // data
    ) external override returns (bytes4) {
        _receivedTokens.push(
            Utils._encodeAsset(AssetType.ERC721, msg.sender, id)
        );
        return IERC721Receiver.onERC721Received.selector;
    }

    function onERC1155Received(
        address, // operator
        address, // from
        uint256 id,
        uint256, // value
        bytes calldata // data
    ) external override returns (bytes4) {
        _receivedTokens.push(
            Utils._encodeAsset(AssetType.ERC1155, msg.sender, id)
        );
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address, // operator
        address, // from
        uint256[] calldata ids,
        uint256[] calldata, // values
        bytes calldata // data
    ) external override returns (bytes4) {
        for (uint256 i = 0; i < ids.length; i++) {
            _receivedTokens.push(
                Utils._encodeAsset(AssetType.ERC1155, msg.sender, ids[i])
            );
        }
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    // TODO: fix this
    function supportsInterface(
        bytes4 // interfaceId
    ) external pure override returns (bool) {
        return false;
    }

    function _makeDeposit(Deposit calldata deposit) internal {
        NocturneAddress calldata depositAddr = deposit.depositAddr;

        _handleRefund(
            depositAddr,
            deposit.encodedAddr,
            deposit.encodedId,
            deposit.value
        );

        require(_vault.makeDeposit(deposit), "Deposit failed");
    }

    function _handleAllSpends(
        JoinSplitTransaction[] calldata joinSplitTxs,
        uint256 maxGasFee
    ) internal {
        uint256 gasToReserve = maxGasFee;
        uint256 gasAssetAddr = joinSplitTxs[0].encodedAddr;
        uint256 gasAssetId = joinSplitTxs[0].encodedId;
        for (uint256 i = 0; i < joinSplitTxs.length; i++) {
            _handleJoinSplit(joinSplitTxs[i]);
            uint256 valueToTransfer = joinSplitTxs[i].publicSpend;
            if (
                gasAssetAddr == joinSplitTxs[i].encodedAddr &&
                gasAssetId == joinSplitTxs[i].encodedId
            ) {
                uint256 gasPayment = Utils.min(joinSplitTxs[i].publicSpend, gasToReserve);
                valueToTransfer -= gasPayment;
                gasToReserve -= gasPayment;
            }
            if (valueToTransfer > 0) {
                _vault.requestAsset(
                    EncodedAsset({
                        encodedAddr: joinSplitTxs[i].encodedAddr,
                        encodedId: joinSplitTxs[i].encodedId
                    }),
                    valueToTransfer
                );
            }
        }
        require(gasToReserve == 0, "Not enough gas tokens unwrapped.");
    }

    function _transferAssetTo(
        EncodedAsset memory encodedAsset,
        address receiver,
        uint256 value
    ) internal {
        (AssetType assetType, address assetAddr, uint256 id) = Utils
            ._decodeAsset(encodedAsset);
        if (assetType == AssetType.ERC20) {
            IERC20(assetAddr).transfer(receiver, value);
        } else if (assetType == AssetType.ERC721) {
            IERC721(assetAddr).transferFrom(address(this), receiver, id);
        } else if (assetType == AssetType.ERC1155) {
            IERC1155(assetAddr).safeTransferFrom(
                address(this),
                receiver,
                id,
                value,
                ""
            );
        }
    }

    function _handleAllRefunds(
        JoinSplitTransaction[] calldata joinSplitTxs,
        NocturneAddress calldata refundAddr
    ) internal {
        uint256 numRefunds = joinSplitTxs.length + _receivedTokens.length;

        EncodedAsset[] memory tokensToProcess = new EncodedAsset[](numRefunds);
        for (uint256 i = 0; i < joinSplitTxs.length; i++) {
            tokensToProcess[i] = EncodedAsset({
                encodedAddr: joinSplitTxs[i].encodedAddr,
                encodedId: joinSplitTxs[i].encodedId
            });
        }
        for (uint256 i = 0; i < _receivedTokens.length; i++) {
            tokensToProcess[joinSplitTxs.length + i] = _receivedTokens[i];
        }
        delete _receivedTokens;

        for (uint256 i = 0; i < tokensToProcess.length; i++) {
            (AssetType assetType, address assetAddr, uint256 id) = Utils
                ._decodeAsset(tokensToProcess[i]);
            uint256 value;
            if (assetType == AssetType.ERC20) {
                value = IERC20(assetAddr).balanceOf(address(this));
                if (value != 0) {
                    require(
                        IERC20(assetAddr).transfer(address(_vault), value),
                        "Error sending funds to vault"
                    );
                }
            } else if (assetType == AssetType.ERC721) {
                if (IERC721(assetAddr).ownerOf(id) == address(this)) {
                    value = 1;
                    IERC721(assetAddr).transferFrom(
                        address(this),
                        address(_vault),
                        id
                    );
                }
            } else if (assetType == AssetType.ERC1155) {
                value = IERC1155(assetAddr).balanceOf(address(this), id);
                if (value != 0) {
                    IERC1155(assetAddr).safeTransferFrom(
                        address(this),
                        address(_vault),
                        id,
                        value,
                        ""
                    );
                }
            }
            if (value != 0) {
                _handleRefund(
                    refundAddr,
                    tokensToProcess[i].encodedAddr,
                    tokensToProcess[i].encodedId,
                    value
                );
            }
        }
    }
}
