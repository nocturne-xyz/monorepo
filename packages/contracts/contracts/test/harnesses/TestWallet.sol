//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {console} from "forge-std/console.sol";

import "../../libs/Types.sol";
import "../../libs/OperationUtils.sol";
import {IWallet} from "../../interfaces/IWallet.sol";
import {Wallet} from "../../Wallet.sol";
import {AssetUtils} from "../../libs/AssetUtils.sol";

contract TestWallet is IWallet {
    Wallet public wallet;

    bytes32 public lastCall;
    uint256 public preCallRequestAssetCount;

    uint256 public ghost_requestAssetCount;

    modifier trackCall(bytes32 key) {
        lastCall = key;
        preCallRequestAssetCount = ghost_requestAssetCount;
        _;
    }

    function processBundle(
        Bundle calldata bundle
    ) external returns (OperationResult[] memory opResults) {
        return wallet.processBundle(bundle);
    }

    function depositFunds(DepositRequest calldata deposit) external {
        wallet.depositFunds(deposit);
    }

    function requestAsset(
        EncodedAsset calldata encodedAsset,
        uint256 value
    ) external {
        wallet.requestAsset(encodedAsset, value);
        ghost_requestAssetCount += 1;
    }
}
