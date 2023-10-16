import { it } from "mocha";
import { assert as chaiAssert } from "chai";
import { assert } from "superstruct";
import {
  SetSpendKeyParams,
  SignCanonAddrRegistryEntryParams,
  SignOperationParams,
} from "../src/validation";

it("validates SetSpendKeyParams", () => {
  const data = {
    spendKey: {
      "0": 1,
      "1": 2,
      "2": 3,
      "3": 4,
    },
  };
  const badData = {
    spendKey: [1, 2, 3, 4], // plain number[], not how uint8array is serialized
  };

  assert(data, SetSpendKeyParams);
  chaiAssert.throws(() => assert(badData, SetSpendKeyParams));
});

it("validates SignCanonAddrRegistryEntryParams", () => {
  const data = {
    entry: {
      ethAddress: "0x1234",
      compressedCanonAddr: 1234n,
      perCanonAddrNonce: 1234n,
    },
    chainId: 1234n,
    registryAddress: "0x1234",
  };
  const badData = {
    entry: {
      ethAddress: "0x1234",
      compressedCanonAddr: "not a bigint",
      perCanonAddrNonce: 1234n,
    },
    chainId: 1234n,
    registryAddress: "0x1234",
  };

  assert(data, SignCanonAddrRegistryEntryParams);
  chaiAssert.throws(() => assert(badData, SignCanonAddrRegistryEntryParams));
});

it("validates SignOperationParams", () => {
  const data = {
    op: {
      networkInfo: {
        chainId: 1234n,
        tellerContract: "0x1234",
      },
      refundAddr: {
        h1: 1234n,
        h2: 1234n,
      },
      refunds: [
        {
          encodedAsset: {
            encodedAssetAddr: 1234n,
            encodedAssetId: 1234n,
          },
          minRefundValue: 1234n,
        },
      ],
      actions: [
        {
          contractAddress: "0x1234",
          encodedFunction: "0x1234",
        },
      ],
      encodedGasAsset: {
        encodedAssetAddr: 1234n,
        encodedAssetId: 1234n,
      },
      gasAssetRefundThreshold: 1234n,
      executionGasLimit: 1234n,
      gasPrice: 1234n,
      deadline: 1234n,
      atomicActions: true,
    },
    metadata: {
      items: [
        {
          type: "Action",
          actionType: "UniswapV3 Swap",
          tokenIn: "0x1234",
          inAmount: 1234n,
          tokenOut: "0x5678",
        },
      ],
    },
  };
  const badData = {
    op: {
      networkInfo: {
        chainId: 1234n,
        tellerContract: "0x1234",
      },
      refundAddr: {
        h1: 1234n,
        h2: 1234n,
      },
      refunds: [
        {
          encodedAsset: {
            encodedAssetAddr: 1234n,
            encodedAssetId: 1234n,
          },
          minRefundValue: 1234n,
        },
      ],
      actions: [
        {
          contractAddress: "0x1234",
          encodedFunction: "0x1234",
        },
      ],
      encodedGasAsset: {
        encodedAssetAddr: 1234n,
        encodedAssetId: 1234n,
      },
      gasAssetRefundThreshold: 1234n,
      executionGasLimit: 1234n,
      gasPrice: 1234n,
      deadline: 1234n,
      atomicActions: true,
    },
    metadata: {
      items: [
        {
          type: "Action",
          actionType: "UNDEFINED", // not a valid action
          tokenIn: "0x1234",
        },
      ],
    },
  };

  assert(data, SignOperationParams);
  chaiAssert.throws(() => assert(badData, SignOperationParams));
});
