//SPDX-License-Identifier: Unlicense
pragma solidity 0.7.6;
pragma abicoder v2;

interface IWallet {
    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct FLAXAddress {
        uint256 H1X;
        uint256 H1Y;
        uint256 H2Hash;
    }

    struct SpendTransaction {
        uint256 commitmentTreeRoot;
        uint256 nullifier;
        uint256 newNoteCommitment;
        uint256[8] proof;
        uint256 value; // 0 for ERC721
        address asset;
        uint256 id; // SNARK_SCALAR_FIELD - 1 for ERC20
        uint256 c; // c, z auth sig fields
        uint256 z;
    }

    struct Tokens {
        address[] spendTokens;
        address[] refundTokens;
    }

    struct WalletBalanceInfo {
        mapping(address => uint256) erc20Balances;
        mapping(address => uint256[]) erc721Ids;
        address[] erc721Addresses;
        mapping(address => uint256[]) erc1155Ids;
        address[] erc1155Addresses;
    }

    struct Bundle {
        Operation[] operations;
    }

    struct Operation {
        SpendTransaction[] spendTxs;
        FLAXAddress refundAddr;
        Tokens tokens;
        Action[] actions;
        uint256 gasLimit;
    }

    struct Action {
        address contractAddress;
        bytes encodedFunction;
    }

    struct Deposit {
        address spender;
        address asset;
        uint256 value;
        uint256 id;
        FLAXAddress depositAddr;
    }

    function processBundle(Bundle calldata bundle)
        external
        returns (bool[] memory successes, bytes[][] memory results);

    function batchDepositFunds(
        Deposit[] calldata deposits,
        Signature[] calldata sigs
    ) external;

    function depositFunds(Deposit calldata deposit) external;
}
