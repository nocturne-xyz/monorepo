// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Wallet} from "../../Wallet.sol";
import "./NocturneUtils.sol";
import "../../libs/Types.sol";

contract ReentrantCaller {
    Wallet _wallet;
    SimpleERC20Token _token;

    uint256 public constant PER_NOTE_AMOUNT = 50_000_000;
    uint256 public constant DEFAULT_GAS_LIMIT = 500_000;

    constructor(Wallet wallet, SimpleERC20Token token) {
        _wallet = wallet;
        _token = token;
    }

    function reentrantProcessBundle() external {
        // Create operation to transfer 4 * 50M tokens to bob
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = NocturneUtils.formatOperation(
            FormatOperationArgs({
                joinSplitToken: _token,
                root: _wallet.root(),
                publicSpendPerJoinSplit: PER_NOTE_AMOUNT,
                numJoinSplits: 6,
                encodedRefundAssets: new EncodedAsset[](0),
                executionGasLimit: DEFAULT_GAS_LIMIT,
                gasPrice: 50,
                action: NocturneUtils.formatTransferAction(
                    _token,
                    address(0x0),
                    PER_NOTE_AMOUNT
                ),
                joinSplitsFailureType: JoinSplitsFailureType.NONE
            })
        );

        _wallet.processBundle(bundle);
    }
}
