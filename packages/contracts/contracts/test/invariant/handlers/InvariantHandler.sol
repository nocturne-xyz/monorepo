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
import {TestDepositManager} from "../../harnesses/TestDepositManager.sol";
import {Wallet} from "../../../Wallet.sol";
import {Handler} from "../../../Handler.sol";
import {CommitmentTreeManager} from "../../../CommitmentTreeManager.sol";
import {ParseUtils} from "../../utils/ParseUtils.sol";
import {EventParsing} from "../../utils/EventParsing.sol";
import {WETH9} from "../../tokens/WETH9.sol";
import {SimpleERC20Token} from "../../tokens/SimpleERC20Token.sol";
import {SimpleERC721Token} from "../../tokens/SimpleERC721Token.sol";
import {SimpleERC1155Token} from "../../tokens/SimpleERC1155Token.sol";
import {AddressSet, LibAddressSet} from "../helpers/AddressSet.sol";
import {LibDepositRequestArray} from "../helpers/DepositRequestArray.sol";
import {Utils} from "../../../libs/Utils.sol";
import {AssetUtils} from "../../../libs/AssetUtils.sol";
import "../../../libs/Types.sol";

contract InvariantHandler is CommonBase, StdCheats, StdUtils {
    using LibAddressSet for AddressSet;
    using LibDepositRequestArray for DepositRequest[];

    uint256 constant ERC20_ID = 0;

    string constant CONTRACT_NAME = "NocturneDepositManager";
    string constant CONTRACT_VERSION = "v1";

    uint256 constant ETH_SUPPLY = 120_500_000 ether;
    uint256 constant GAS_COMPENSATION = 100_000 * 50 gwei;

    uint256 constant SCREENER_PRIVKEY = 1;
    address SCREENER_ADDRESS = vm.addr(SCREENER_PRIVKEY);

    Wallet public wallet;
    Handler public handler;
    TestDepositManager public depositManager;

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

    DepositRequest[] internal _depositSet;

    modifier createActor() {
        uint256 seed;
        seed = bound(seed, 1, type(uint160).max);

        currentActor = address(uint160(seed));
        _actors.add(currentActor);
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

    receive() external payable {}

    fallback() external payable {}

    constructor() {
        wallet = new Wallet();
        handler = new Handler();
        depositManager = new TestDepositManager();

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
        depositManager.setScreenerPermission(SCREENER_ADDRESS, true);

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

    function callSummary() external view {
        console.log("Call summary:");
        console.log("-------------------");
        console.log(
            "instantiateDepositErc20",
            calls["instantiateDepositErc20"]
        );
        console.log("retrieveDepositErc20", calls["retrieveDepositErc20"]);
        console.log("completeDepositErc20", calls["completeDepositErc20"]);
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

        // Start recording logs and make call
        vm.recordLogs();
        StealthAddress memory depositAddr = NocturneUtils
            .defaultStealthAddress();
        depositManager.instantiateDeposit{value: GAS_COMPENSATION}(
            encodedErc20,
            amount,
            depositAddr
        );

        // Recover deposit request
        Vm.Log[] memory entries = vm.getRecordedLogs();
        Vm.Log memory entry = entries[entries.length - 1];
        DepositRequest memory req = EventParsing.decodeDepositRequestFromEvent(
            entry
        );

        vm.stopPrank();

        // Update set and sum
        _depositSet.push(req);
        ghost_instantiateDepositSum += amount;
    }

    function retrieveDepositErc20(
        uint256 seed
    ) public countCall("retrieveDepositErc20") {
        // Get random request
        uint256 index;
        if (_depositSet.length > 0) {
            index = seed % _depositSet.length;
        } else {
            return;
        }

        DepositRequest memory randDepositRequest = _depositSet[index];

        // Complete deposit
        vm.prank(randDepositRequest.spender);
        depositManager.retrieveDeposit(randDepositRequest);

        // Update completed deposit sum and deposit set
        ghost_retrieveDepositSum += randDepositRequest.value;
        _depositSet.pop(index);
    }

    function completeDepositErc20(
        uint256 seed
    ) public countCall("completeDepositErc20") {
        // Get random request
        uint256 index;
        if (_depositSet.length > 0) {
            index = seed % _depositSet.length;
        } else {
            return;
        }

        DepositRequest memory randDepositRequest = _depositSet[index];

        // Sign with screener
        bytes32 digest = depositManager.computeDigest(randDepositRequest);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SCREENER_PRIVKEY, digest);
        bytes memory signature = ParseUtils.rsvToSignatureBytes(
            uint256(r),
            uint256(s),
            v
        );

        // Complete deposit
        depositManager.completeDeposit(randDepositRequest, signature);

        // Update completed deposit sum and deposit set
        ghost_completeDepositSum += randDepositRequest.value;
        _depositSet.pop(index);

        // TODO: track gas compensation
    }
}
