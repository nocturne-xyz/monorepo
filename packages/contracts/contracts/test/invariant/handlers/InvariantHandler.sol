// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {console} from "forge-std/console.sol";

import {IJoinSplitVerifier} from "../../../interfaces/IJoinSplitVerifier.sol";
import {ISubtreeUpdateVerifier} from "../../../interfaces/ISubtreeUpdateVerifier.sol";
import {OffchainMerkleTree, OffchainMerkleTreeData} from "../../../libs/OffchainMerkleTree.sol";
import {PoseidonHasherT3, PoseidonHasherT4, PoseidonHasherT5, PoseidonHasherT6} from "../../utils/PoseidonHashers.sol";
import {IHasherT3, IHasherT5, IHasherT6} from "../../interfaces/IHasher.sol";
import {PoseidonDeployer} from "../../utils/PoseidonDeployer.sol";
import {IPoseidonT3} from "../../interfaces/IPoseidon.sol";
import {TestJoinSplitVerifier} from "../../harnesses/TestJoinSplitVerifier.sol";
import {TestSubtreeUpdateVerifier} from "../../harnesses/TestSubtreeUpdateVerifier.sol";
import {ReentrantCaller} from "../../utils/ReentrantCaller.sol";
import {TokenSwapper, SwapRequest} from "../../utils/TokenSwapper.sol";
import {TreeTest, TreeTestLib} from "../../utils/TreeTest.sol";
import "../../utils/NocturneUtils.sol";
import "../../utils/ForgeUtils.sol";
import {DepositManager} from "../../../DepositManager.sol";
import {Wallet} from "../../../Wallet.sol";
import {Handler} from "../../../Handler.sol";
import {CommitmentTreeManager} from "../../../CommitmentTreeManager.sol";
import {ParseUtils} from "../../utils/ParseUtils.sol";
import {WETH9} from "../../tokens/WETH9.sol";
import {SimpleERC20Token} from "../../tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "../../tokens/SimpleERC721Token.sol";
import {SimpleERC1155Token} from "../../tokens/SimpleERC1155Token.sol";
import {AddressSet, LibAddressSet} from "../helpers/AddressSet.sol";
import {DepositRequestSet, LibDepositRequestSet} from "../helpers/DepositRequestSet.sol";
import {Utils} from "../../../libs/Utils.sol";
import {AssetUtils} from "../../../libs/AssetUtils.sol";
import "../../../libs/Types.sol";

contract InvariantHandler is CommonBase, StdCheats, StdUtils {
    using LibAddressSet for AddressSet;
    using LibDepositRequestSet for DepositRequestSet;

    uint256 constant ERC20_ID = 0;

    string constant CONTRACT_NAME = "NocturneDepositManager";
    string constant CONTRACT_VERSION = "v1";

    uint256 constant ETH_SUPPLY = 120_500_000 ether;
    uint256 constant GAS_COMPENSATION = 100_000 * 50 gwei;

    Wallet public wallet;
    Handler public handler;
    DepositManager public depositManager;

    WETH9 public weth;
    SimpleERC20Token public erc20;
    SimpleERC721Token public erc721;
    SimpleERC1155Token public erc1155;

    EncodedAsset public encodedErc20;

    uint256 public ghost_instantiateDepositSum = 0;
    uint256 public ghost_retrieveDepositSum = 0;
    uint256 public ghost_completeDepositSum = 0;

    mapping(bytes32 => uint256) public calls;

    AddressSet internal _actors;
    address internal currentActor;

    DepositRequestSet internal _depositRequestSet;

    modifier createActor() {
        currentActor = msg.sender;
        _actors.add(msg.sender);
        _;
    }

    modifier useActor(uint256 actorIndexSeed) {
        currentActor = _actors.rand(actorIndexSeed);
        _;
    }

    modifier countCall(bytes32 key) {
        calls[key]++;
        _;
    }

    constructor() {
        wallet = new Wallet();
        handler = new Handler();
        depositManager = new DepositManager();

        weth = new WETH9();

        TestJoinSplitVerifier joinSplitVerifier = new TestJoinSplitVerifier();
        TestSubtreeUpdateVerifier subtreeUpdateVerifier = new TestSubtreeUpdateVerifier();

        handler.initialize(address(wallet), address(subtreeUpdateVerifier));
        wallet.initialize(address(handler), address(joinSplitVerifier));

        wallet.setDepositSourcePermission(address(depositManager), true);
        handler.setSubtreeBatchFillerPermission(address(this), true);

        depositManager.initialize(
            CONTRACT_NAME,
            CONTRACT_VERSION,
            address(wallet),
            address(weth)
        );

        erc20 = new SimpleERC20Token();
        erc721 = new SimpleERC721Token();
        erc1155 = new SimpleERC1155Token();

        encodedErc20 = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(erc20),
            ERC20_ID
        );

        vm.deal(address(this), ETH_SUPPLY);
        erc20.reserveTokens(address(this), type(uint256).max);
    }

    function instantiateDepositErc20(
        uint256 amount
    ) public createActor countCall("instantiateDepositErc20") {
        // Bound deposit amount
        amount = bound(amount, 0, erc20.balanceOf(address(this)));
        erc20.transfer(currentActor, amount);

        // Deal gas compensation
        deal(currentActor, GAS_COMPENSATION);

        // Approve token
        vm.startPrank(currentActor);
        erc20.approve(address(depositManager), amount);

        StealthAddress memory depositAddr = NocturneUtils
            .defaultStealthAddress();

        // Save deposit request pre call
        DepositRequest memory req = DepositRequest({
            spender: currentActor,
            encodedAsset: encodedErc20,
            value: amount,
            depositAddr: depositAddr,
            nonce: depositManager._nonces(currentActor),
            gasCompensation: GAS_COMPENSATION
        });

        // Make call
        depositManager.instantiateDeposit{value: GAS_COMPENSATION}(
            encodedErc20,
            amount,
            depositAddr
        );
        vm.stopPrank();

        // Update set and sum
        _depositRequestSet.add(currentActor, req);
        ghost_instantiateDepositSum += amount;
    }

    function retrieveDepositErc() public countCall("retrieveDepositErc20") {}
}
