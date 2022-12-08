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

    struct NoteTransmission {
        NocturneAddress owner;
        uint256 encappedKey;
        uint256 encryptedNonce;
        uint256 encryptedValue;
    }

    struct JoinSplitTransaction {
        uint256 commitmentTreeRoot;
        uint256 nullifierA;
        uint256 nullifierB;
        uint256 newNoteACommitment;
        uint256 newNoteBCommitment;
        uint256[8] proof;
        address asset;
        uint256 id; // SNARK_SCALAR_FIELD - 1 for ERC20
        uint256 publicSpend;
        NoteTransmission newNoteATransmission;
        NoteTransmission newNoteBTransmission;
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

<<<<<<< HEAD
    struct OperationAndDigest {
        Operation operation;
        uint256 operationDigest;
=======
    struct OperationResult {
        bool opSuccess;
        bool[] callSuccesses;
        bytes[] callResults;
>>>>>>> eaab15c (feat(contracts): emit OperationProcessed event and test in wallet tests)
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
    ) external returns (IWallet.OperationResult[] memory opResults);

    function batchDepositFunds(
        Deposit[] calldata deposits,
        Signature[] calldata sigs
    ) external;

    function depositFunds(Deposit calldata deposit) external;
}
