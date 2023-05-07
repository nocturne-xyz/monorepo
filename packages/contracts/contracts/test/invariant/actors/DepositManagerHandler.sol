// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {console} from "forge-std/console.sol";

import "../../utils/NocturneUtils.sol";
import "../../utils/ForgeUtils.sol";
import {TestDepositManager} from "../../harnesses/TestDepositManager.sol";
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
        _;
        _calls[lastCall]++;
    }

    receive() external payable {}

    fallback() external payable {}

    // ______EXTERNAL______
    function callSummary() external view {
        console.log("-------------------");
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
        console.log("no-op", _calls["no-op"]);
    }

    function instantiateDepositETH(
        uint256 seed
    ) public createActor trackCall("instantiateDepositETH") {
        // Bound deposit amount
        uint256 amount = bound(seed, 0, ETH_SUPPLY);
        if (amount == 0) {
            lastCall = "no-op";
            return;
        }

        _depositSizes.push(amount);

        // Deal gas compensation
        vm.deal(_currentActor, amount + GAS_COMPENSATION);

        vm.startPrank(_currentActor);

        // Start recording logs and make call
        vm.recordLogs();
        StealthAddress memory depositAddr = NocturneUtils
            .defaultStealthAddress();

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        depositManager.instantiateETHMultiDeposit{
            value: amount + GAS_COMPENSATION
        }(amounts, depositAddr);

        // Recover deposit request
        Vm.Log[] memory entries = vm.getRecordedLogs();
        Vm.Log memory entry = entries[0]; // last is transfer event, 2nd to last is deposit event
        DepositRequest memory req = EventParsing
            .decodeDepositRequestFromDepositEvent(entry);

        vm.stopPrank();

        // Update sets and sum
        _depositSet.push(req);
        _instantiateDepositSumSetETH.addToActorSum(_currentActor, amount);
    }

    function instantiateDepositErc20(
        uint256 seed
    ) public createActor trackCall("instantiateDepositErc20") {
        (, uint32 globalCapWholeTokens, , , uint8 precision) = depositManager
            ._erc20Caps(address(erc20));
        uint256 globalCap = uint256(globalCapWholeTokens) * 10 ** precision;

        // Bound deposit amount
        uint256 amount = bound(seed, 0, globalCap);
        if (amount == 0) {
            lastCall = "no-op";
            return;
        }

        erc20.reserveTokens(_currentActor, amount);
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

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        depositManager.instantiateErc20MultiDeposit{value: GAS_COMPENSATION}(
            address(erc20),
            amounts,
            depositAddr
        );

        // Recover deposit request
        Vm.Log[] memory entries = vm.getRecordedLogs();
        Vm.Log memory entry = entries[0]; // last is transfer event, 2nd to last is deposit event
        DepositRequest memory req = EventParsing
            .decodeDepositRequestFromDepositEvent(entry);

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
            EncodedAsset memory encodedWeth = AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(depositManager._weth()),
                ERC20_ID
            );
            if (
                randDepositRequest.encodedAsset.encodedAssetAddr ==
                encodedWeth.encodedAssetAddr
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
        uint256 warpTimestamp;
        unchecked {
            warpTimestamp = block.timestamp + seed;
        }
        vm.warp(warpTimestamp);
        try depositManager.completeErc20Deposit(randDepositRequest, signature) {
            EncodedAsset memory encodedWeth = AssetUtils.encodeAsset(
                AssetType.ERC20,
                address(depositManager._weth()),
                ERC20_ID
            );
            if (
                randDepositRequest.encodedAsset.encodedAssetAddr ==
                encodedWeth.encodedAssetAddr
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
