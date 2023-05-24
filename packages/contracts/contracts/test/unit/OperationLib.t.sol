// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import "../../libs/Types.sol";
import "../utils/NocturneUtils.sol";
import "../harnesses/TestOperationLib.sol";

contract OperationLibTest is Test {
    TestOperationLib testOperationLib;

    function setUp() public {
        testOperationLib = new TestOperationLib();
    }

    function testValidEncodedAssetPassesValidation() public {
        JoinSplit[] memory joinSplits = new JoinSplit[](6);
        for (uint256 i = 0; i < 6; i++) {
            joinSplits[i] = NocturneUtils.dummyJoinSplit();
        }

        EncodedAssetWithLastIndex[]
            memory encodedAssetsWithLastIndex = new EncodedAssetWithLastIndex[](
                3
            );
        encodedAssetsWithLastIndex[0] = EncodedAssetWithLastIndex({
            encodedAsset: EncodedAsset({
                encodedAssetAddr: 1,
                encodedAssetId: 2
            }),
            lastIndex: 1
        });
        encodedAssetsWithLastIndex[1] = EncodedAssetWithLastIndex({
            encodedAsset: EncodedAsset({
                encodedAssetAddr: 3,
                encodedAssetId: 4
            }),
            lastIndex: 3
        });
        encodedAssetsWithLastIndex[2] = EncodedAssetWithLastIndex({
            encodedAsset: EncodedAsset({
                encodedAssetAddr: 5,
                encodedAssetId: 6
            }),
            lastIndex: 5
        });

        Operation memory op;
        op.joinSplits = joinSplits;
        op.encodedAssetsWithLastIndex = encodedAssetsWithLastIndex;

        testOperationLib.ensureValidEncodedAssetsWithLastIndex(op);
    }

    function testValidEncodedAssetWithEmptyJoinSplitsAndAssetsFails() public {
        JoinSplit[] memory joinSplits = new JoinSplit[](0);
        EncodedAssetWithLastIndex[]
            memory encodedAssetsWithLastIndex = new EncodedAssetWithLastIndex[](
                0
            );

        Operation memory op;
        op.joinSplits = joinSplits;
        op.encodedAssetsWithLastIndex = encodedAssetsWithLastIndex;
        op.gasPrice = 1;

        vm.expectRevert("empty joinsplits or assets");
        testOperationLib.ensureValidEncodedAssetsWithLastIndex(op);
    }

    function testEncodedAssetsWithLastIndexOverJoinSplitsLengthFails() public {
        JoinSplit[] memory joinSplits = new JoinSplit[](6);
        for (uint256 i = 0; i < 6; i++) {
            joinSplits[i] = NocturneUtils.dummyJoinSplit();
        }

        EncodedAssetWithLastIndex[]
            memory encodedAssetsWithLastIndex = new EncodedAssetWithLastIndex[](
                3
            );
        encodedAssetsWithLastIndex[0] = EncodedAssetWithLastIndex({
            encodedAsset: EncodedAsset({
                encodedAssetAddr: 1,
                encodedAssetId: 2
            }),
            lastIndex: 1
        });
        encodedAssetsWithLastIndex[1] = EncodedAssetWithLastIndex({
            encodedAsset: EncodedAsset({
                encodedAssetAddr: 3,
                encodedAssetId: 4
            }),
            lastIndex: 4
        });
        encodedAssetsWithLastIndex[2] = EncodedAssetWithLastIndex({
            encodedAsset: EncodedAsset({
                encodedAssetAddr: 5,
                encodedAssetId: 6
            }),
            lastIndex: 6 // this is joinsplits.length which is 1 over joinsplits.length - 1
        });

        Operation memory op;
        op.joinSplits = joinSplits;
        op.encodedAssetsWithLastIndex = encodedAssetsWithLastIndex;

        vm.expectRevert("last index != joinsplit.length-1");
        testOperationLib.ensureValidEncodedAssetsWithLastIndex(op);
    }

    function testEncodedAssetsWithMiddleIndexOverJoinSplitsLengthFails()
        public
    {
        JoinSplit[] memory joinSplits = new JoinSplit[](6);
        for (uint256 i = 0; i < 6; i++) {
            joinSplits[i] = NocturneUtils.dummyJoinSplit();
        }

        EncodedAssetWithLastIndex[]
            memory encodedAssetsWithLastIndex = new EncodedAssetWithLastIndex[](
                3
            );
        encodedAssetsWithLastIndex[0] = EncodedAssetWithLastIndex({
            encodedAsset: EncodedAsset({
                encodedAssetAddr: 1,
                encodedAssetId: 2
            }),
            lastIndex: 1
        });
        encodedAssetsWithLastIndex[1] = EncodedAssetWithLastIndex({
            encodedAsset: EncodedAsset({
                encodedAssetAddr: 3,
                encodedAssetId: 4
            }),
            lastIndex: 6 // > joinsplits.length - 1 (also not strictly increasing)
        });
        encodedAssetsWithLastIndex[2] = EncodedAssetWithLastIndex({
            encodedAsset: EncodedAsset({
                encodedAssetAddr: 5,
                encodedAssetId: 6
            }),
            lastIndex: 5
        });

        Operation memory op;
        op.joinSplits = joinSplits;
        op.encodedAssetsWithLastIndex = encodedAssetsWithLastIndex;

        vm.expectRevert("middle index > joinsplit.length-1");
        testOperationLib.ensureValidEncodedAssetsWithLastIndex(op);
    }

    function testEncodedAssetsWithNonIncreasingIndicesFails() public {
        JoinSplit[] memory joinSplits = new JoinSplit[](6);
        for (uint256 i = 0; i < 6; i++) {
            joinSplits[i] = NocturneUtils.dummyJoinSplit();
        }

        EncodedAssetWithLastIndex[]
            memory encodedAssetsWithLastIndex = new EncodedAssetWithLastIndex[](
                3
            );
        encodedAssetsWithLastIndex[0] = EncodedAssetWithLastIndex({
            encodedAsset: EncodedAsset({
                encodedAssetAddr: 1,
                encodedAssetId: 2
            }),
            lastIndex: 3
        });
        encodedAssetsWithLastIndex[1] = EncodedAssetWithLastIndex({
            encodedAsset: EncodedAsset({
                encodedAssetAddr: 3,
                encodedAssetId: 4
            }),
            lastIndex: 2 // 3 -> 2 is not monotonically increasing
        });
        encodedAssetsWithLastIndex[2] = EncodedAssetWithLastIndex({
            encodedAsset: EncodedAsset({
                encodedAssetAddr: 5,
                encodedAssetId: 6
            }),
            lastIndex: joinSplits.length - 1
        });

        Operation memory op;
        op.joinSplits = joinSplits;
        op.encodedAssetsWithLastIndex = encodedAssetsWithLastIndex;

        vm.expectRevert("!increasing indices");
        testOperationLib.ensureValidEncodedAssetsWithLastIndex(op);
    }
}
