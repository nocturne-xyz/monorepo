//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.5;
pragma abicoder v2;

interface IWallet {
    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct NocturneAddress {
        uint256 h1X;
        uint256 h1Y;
        uint256 h2X;
        uint256 h2Y;
    }

    struct EncodedNocturneAddress {
        uint256 h1X;
        uint256 h2X;
    }

    struct JoinSplitTransaction {
        uint256 commitmentTreeRoot;
        uint256 nullifierA;
        uint256 nullifierB;
        uint256 newNoteACommitment;
        NocturneAddress newNoteAOwner;
        uint256 encappedKeyA;
        uint256[2] encryptedNoteA;
        uint256 newNoteBCommitment;
        NocturneAddress newNoteBOwner;
        uint256 encappedKeyB;
        uint256[2] encryptedNoteB;
        uint256[8] proof;
        uint256 opDigest;
        address asset;
        uint256 id; // SNARK_SCALAR_FIELD - 1 for ERC20
        uint256 publicSpend;
    }

    struct Note {
        uint256 ownerH1;
        uint256 ownerH2;
        uint256 nonce;
        uint256 asset;
        uint256 id;
        uint256 value;
    }

    struct SubtreeUpdateArgs {
        uint256 oldRoot;
        uint256 newRoot;
        uint256[8] proof;
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
        JoinSplitTransaction[] joinSplitTxs;
        NocturneAddress refundAddr;
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
        NocturneAddress depositAddr;
    }

    function processBundle(
        Bundle calldata bundle
    ) external returns (bool[] memory successes, bytes[][] memory results);

    function batchDepositFunds(
        Deposit[] calldata deposits,
        Signature[] calldata sigs
    ) external;

    function depositFunds(Deposit calldata deposit) external;
}
