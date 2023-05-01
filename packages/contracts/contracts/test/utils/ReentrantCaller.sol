// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Teller} from "../../Teller.sol";
import {Handler} from "../../Handler.sol";
import "./NocturneUtils.sol";
import "../../libs/Types.sol";

contract ReentrantCaller {
    Teller _teller;
    Handler _handler;
    SimpleERC20Token _token;

    uint256 public constant PER_NOTE_AMOUNT = 50_000_000;
    uint256 public constant DEFAULT_GAS_LIMIT = 500_000;

    modifier onlyTeller() {
        require(msg.sender == address(_teller), "Only teller");
        _;
    }

    constructor(Teller teller, Handler handler, SimpleERC20Token token) {
        _teller = teller;
        _handler = handler;
        _token = token;
    }

    function formatOperation() internal view returns (Operation memory) {
        return
            NocturneUtils.formatOperation(
                FormatOperationArgs({
                    joinSplitToken: _token,
                    gasToken: _token,
                    root: _handler.root(),
                    joinSplitPublicSpends: NocturneUtils
                        .fillJoinSplitPublicSpends(PER_NOTE_AMOUNT, 6),
                    encodedRefundAssets: new EncodedAsset[](0),
                    executionGasLimit: DEFAULT_GAS_LIMIT,
                    maxNumRefunds: 1,
                    gasPrice: 50,
                    actions: NocturneUtils.formatSingleTransferActionArray(
                        _token,
                        address(0x0),
                        PER_NOTE_AMOUNT
                    ),
                    atomicActions: false,
                    operationFailureType: OperationFailureType.NONE
                })
            );
    }

    function reentrantProcessBundle() external {
        // Create operation to transfer 4 * 50M tokens to bob
        Bundle memory bundle = Bundle({operations: new Operation[](1)});
        bundle.operations[0] = formatOperation();
        _teller.processBundle(bundle);
    }

    function reentrantHandleOperation() external {
        Operation memory op = formatOperation();
        _handler.handleOperation(op, 0, address(0x0));
    }

    function reentrantExecuteActions() external {
        Operation memory op = formatOperation();
        _handler.executeActions(op);
    }
}
