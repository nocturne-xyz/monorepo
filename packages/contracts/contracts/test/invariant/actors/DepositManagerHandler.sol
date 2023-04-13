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
import {DepositSumSet, LibDepositSumSet} from "../helpers/DepositSumSet.sol";
import {LibDepositRequestArray} from "../helpers/DepositRequestArray.sol";
import {Utils} from "../../../libs/Utils.sol";
import {AssetUtils} from "../../../libs/AssetUtils.sol";
import "../../../libs/Types.sol";

contract DepositManagerHandler is CommonBase, StdCheats, StdUtils {
    using LibAddressSet for AddressSet;
    using LibDepositRequestArray for DepositRequest[];
    using LibDepositSumSet for DepositSumSet;

    uint256 constant ERC20_ID = 0;

    string constant CONTRACT_NAME = "NocturneDepositManager";
    string constant CONTRACT_VERSION = "v1";

    uint256 constant ETH_SUPPLY = 120_500_000 ether;
    uint256 constant GAS_COMPENSATION = 100_000 * 50 gwei;

    uint256 constant SCREENER_PRIVKEY = 1;
    address SCREENER_ADDRESS = vm.addr(SCREENER_PRIVKEY);

    // ______PUBLIC______
    TestDepositManager public depositManager;

    WETH9 public weth;
    SimpleERC20Token public erc20;
    SimpleERC721Token public erc721;
    SimpleERC1155Token public erc1155;

    EncodedAsset public encodedErc20;

    bytes32 public lastCall;

    // ______INTERNAL______
    mapping(bytes32 => uint256) internal _calls;
    mapping(string => uint256) internal _reverts;
    uint256[] internal _depositSizes;
    AddressSet internal _actors;
    address internal _currentActor;
    uint256 internal _actorNum = 0;

    DepositSumSet internal _instantiateDepositSumSetETH;
    DepositSumSet internal _retrieveDepositSumSetETH;
    DepositSumSet internal _completeDepositSumSetETH;

    DepositSumSet internal _instantiateDepositSumSetErc20;
    DepositSumSet internal _retrieveDepositSumSetErc20;
    DepositSumSet internal _completeDepositSumSetErc20;

    DepositRequest[] internal _depositSet;

    constructor(
        TestDepositManager _depositManager,
        SimpleERC20Token _erc20,
        SimpleERC721Token _erc721,
        SimpleERC1155Token _erc1155
    ) {
        depositManager = _depositManager;
        erc20 = _erc20;
        erc721 = _erc721;
        erc1155 = _erc1155;

        encodedErc20 = AssetUtils.encodeAsset(
            AssetType.ERC20,
            address(_erc20),
            ERC20_ID
        );
    }

    modifier createActor() {
        _currentActor = msg.sender;

        if (!_actors.contains(_currentActor)) {
            _actors.add(_currentActor);
            _actorNum += 1;
        }
        _;
    }

    modifier useActor(uint256 actorIndexSeed) {
        _currentActor = _actors.rand(actorIndexSeed);
        _;
    }

    modifier trackCall(bytes32 key) {
        lastCall = key;
        _calls[key]++;
        _;
    }

    receive() external payable {}

    fallback() external payable {}

    // ______EXTERNAL______

    function callSummary() external view {
        console.log("DepositManagerHandler call summary:");
        console.log("-------------------");
        console.log("instantiateDepositETH", _calls["instantiateDepositETH"]);
        console.log(
            "instantiateDepositErc20",
            _calls["instantiateDepositErc20"]
        );
        console.log("retrieveDepositErc20", _calls["retrieveDepositErc20"]);
        console.log("completeDepositErc20", _calls["completeDepositErc20"]);

        console.log(
            "instantiateDepositSumErc20",
            ghost_instantiateDepositSumErc20()
        );
        console.log("retrieveDepositSumErc20", ghost_retrieveDepositSumErc20());
        console.log("completeDepositSumErc20", ghost_completeDepositSumErc20());

        console.log("_actorNum", _actorNum);
        console.log("depositSetLength", _depositSet.length);

        console.log(
            "retrieveDepositErc20 reverts",
            _reverts["retrieveDepositErc20"]
        );
        console.log(
            "completeDepositErc20 reverts",
            _reverts["completeDepositErc20"]
        );
    }

    function instantiateDepositETH(
        uint256 amount
    ) public createActor trackCall("instantiateDepositETH") {
        // Bound deposit amount
        amount = bound(amount, 0, ETH_SUPPLY);
        _depositSizes.push(amount);

        // Deal gas compensation
        vm.deal(_currentActor, amount + GAS_COMPENSATION);

        vm.startPrank(_currentActor);

        // Start recording logs and make call
        vm.recordLogs();
        StealthAddress memory depositAddr = NocturneUtils
            .defaultStealthAddress();
        depositManager.instantiateETHDeposit{value: amount + GAS_COMPENSATION}(
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

        // Update sets and sum
        _depositSet.push(req);
        _instantiateDepositSumSetETH.addToActorSum(_currentActor, amount);
    }

    function instantiateDepositErc20(
        uint256 amount
    ) public createActor trackCall("instantiateDepositErc20") {
        // Bound deposit amount
        amount = bound(amount, 0, erc20.balanceOf(address(this)));
        erc20.transfer(_currentActor, amount);
        _depositSizes.push(amount);

        // Deal gas compensation
        vm.deal(_currentActor, GAS_COMPENSATION);

        // Approve token
        vm.startPrank(_currentActor);
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

        // Update sets and sum
        _depositSet.push(req);
        _instantiateDepositSumSetErc20.addToActorSum(_currentActor, amount);
    }

    function retrieveDepositErc20(
        uint256 seed
    ) public trackCall("retrieveDepositErc20") {
        // Get random request
        uint256 index;
        if (_depositSet.length > 0) {
            index = seed % _depositSet.length;
        } else {
            return;
        }

        DepositRequest memory randDepositRequest = _depositSet[index];

        // Retrieve deposit
        vm.prank(randDepositRequest.spender);
        try depositManager.retrieveDeposit(randDepositRequest) {
            (uint256 encodedWethAddr, ) = depositManager._wethEncoded();
            if (
                randDepositRequest.encodedAsset.encodedAssetAddr ==
                encodedWethAddr
            ) {
                _retrieveDepositSumSetETH.addToActorSum(
                    randDepositRequest.spender,
                    randDepositRequest.value
                );
            } else {
                _retrieveDepositSumSetErc20.addToActorSum(
                    randDepositRequest.spender,
                    randDepositRequest.value
                );
            }
        } catch {
            _reverts["retrieveDepositErc20"] += 1;
        }
    }

    function completeDepositErc20(
        uint256 seed
    ) public trackCall("completeDepositErc20") {
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
        try depositManager.completeDeposit(randDepositRequest, signature) {
            (uint256 encodedWethAddr, ) = depositManager._wethEncoded();
            if (
                randDepositRequest.encodedAsset.encodedAssetAddr ==
                encodedWethAddr
            ) {
                _completeDepositSumSetETH.addToActorSum(
                    randDepositRequest.spender,
                    randDepositRequest.value
                );
            } else {
                _completeDepositSumSetErc20.addToActorSum(
                    randDepositRequest.spender,
                    randDepositRequest.value
                );
            }
        } catch {
            _reverts["completeDepositErc20"] += 1;
        }

        // TODO: track gas compensation
    }

    // ______VIEW______

    function ghost_AllActors() public view returns (address[] memory) {
        return _actors.addresses();
    }

    function ghost_instantiateDepositSumETH() public view returns (uint256) {
        return _instantiateDepositSumSetETH.getTotalForAll();
    }

    function ghost_retrieveDepositSumETH() public view returns (uint256) {
        return _retrieveDepositSumSetETH.getTotalForAll();
    }

    function ghost_completeDepositSumETH() public view returns (uint256) {
        return _completeDepositSumSetETH.getTotalForAll();
    }

    function ghost_instantiateDepositSumETHFor(
        address actor
    ) public view returns (uint256) {
        return _instantiateDepositSumSetETH.getSumForActor(actor);
    }

    function ghost_retrieveDepositSumETHFor(
        address actor
    ) public view returns (uint256) {
        return _retrieveDepositSumSetETH.getSumForActor(actor);
    }

    function ghost_completeDepositSumETHFor(
        address actor
    ) public view returns (uint256) {
        return _completeDepositSumSetETH.getSumForActor(actor);
    }

    function ghost_instantiateDepositSumErc20() public view returns (uint256) {
        return _instantiateDepositSumSetErc20.getTotalForAll();
    }

    function ghost_retrieveDepositSumErc20() public view returns (uint256) {
        return _retrieveDepositSumSetErc20.getTotalForAll();
    }

    function ghost_completeDepositSumErc20() public view returns (uint256) {
        return _completeDepositSumSetErc20.getTotalForAll();
    }

    function ghost_instantiateDepositSumErc20For(
        address actor
    ) public view returns (uint256) {
        return _instantiateDepositSumSetErc20.getSumForActor(actor);
    }

    function ghost_retrieveDepositSumErc20For(
        address actor
    ) public view returns (uint256) {
        return _retrieveDepositSumSetErc20.getSumForActor(actor);
    }

    function ghost_completeDepositSumErc20For(
        address actor
    ) public view returns (uint256) {
        return _completeDepositSumSetErc20.getSumForActor(actor);
    }
}
