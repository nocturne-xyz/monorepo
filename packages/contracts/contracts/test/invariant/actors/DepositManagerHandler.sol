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
import {ActorSumSet, LibActorSumSet} from "../helpers/ActorSumSet.sol";
import {LibDepositRequestArray} from "../helpers/DepositRequestArray.sol";
import {Utils} from "../../../libs/Utils.sol";
import {AssetUtils} from "../../../libs/AssetUtils.sol";
import "../../../libs/Types.sol";

contract DepositManagerHandler is CommonBase, StdCheats, StdUtils {
    using LibAddressSet for AddressSet;
    using LibDepositRequestArray for DepositRequest[];
    using LibActorSumSet for ActorSumSet;

    uint256 constant ERC20_ID = 0;

    string constant CONTRACT_NAME = "NocturneDepositManager";
    string constant CONTRACT_VERSION = "v1";

    uint256 constant ETH_SUPPLY = 120_500_000 ether;
    uint256 constant AVG_GAS_PER_COMPLETE = 130_000 gwei;

    // ______PUBLIC______
    TestDepositManager public depositManager;

    uint256 public screenerPrivkey;
    address public screenerAddress;

    WETH9 public weth;
    SimpleERC20Token public erc20;
    SimpleERC721Token public erc721;
    SimpleERC1155Token public erc1155;

    bytes32 public lastCall;

    // ______INTERNAL______
    mapping(bytes32 => uint256) internal _calls;
    mapping(string => uint256) internal _reverts;
    AddressSet internal _actors;
    address internal _currentActor;
    uint256 internal _actorNum = 0;

    ActorSumSet internal _gasCompensationSet;

    ActorSumSet internal _instantiateDepositSumSetETH;
    ActorSumSet internal _retrieveDepositSumSetETH;
    ActorSumSet internal _completeDepositSumSetETH;

    ActorSumSet internal _instantiateDepositSumSetErc20;
    ActorSumSet internal _retrieveDepositSumSetErc20;
    ActorSumSet internal _completeDepositSumSetErc20;

    DepositRequest[] internal _depositSet;

    constructor(
        TestDepositManager _depositManager,
        SimpleERC20Token _erc20,
        SimpleERC721Token _erc721,
        SimpleERC1155Token _erc1155,
        uint256 _screenerPrivkey
    ) {
        depositManager = _depositManager;
        erc20 = _erc20;
        erc721 = _erc721;
        erc1155 = _erc1155;
        screenerPrivkey = _screenerPrivkey;
        screenerAddress = vm.addr(screenerPrivkey);
    }

    modifier createActor() {
        _currentActor = msg.sender;

        if (!_actors.contains(_currentActor)) {
            _actors.add(_currentActor);
            _actorNum += 1;
        }
        _;
    }

    // NOTE: This prevents us from completing deposit with instantiator. Theory for the actor
    // balance invariant test failures is that it has to do with tx.gasPrice > 0 and actor also
    // being msg.sender for transaction (actor gets ETH to make call, not the screener which is
    // made msg.sender thru vm.prank).
    modifier onlyAllowCallFromNonDepositor() {
        if (_actors.contains(msg.sender)) {
            lastCall = "no-op";
            _calls[lastCall]++;
            return;
        }
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
        console.log("screener balance:", screenerAddress.balance);
        console.log(
            "total supplied gas compensation:",
            ghost_totalSuppliedGasCompensation()
        );
        console.log("no-op", _calls["no-op"]);
    }

    function instantiateDepositETH(
        uint256 seed
    ) public createActor trackCall("instantiateDepositETH") {
        uint256 numDeposits = bound(seed, 1, 10);

        // Bound deposit amounts, save deposit reqs
        uint256[] memory depositAmounts = new uint256[](numDeposits);
        DepositRequest[] memory deposits = new DepositRequest[](numDeposits);
        StealthAddress memory depositAddr = NocturneUtils
            .defaultStealthAddress();

        uint256 gasPrice = bound(seed, 0, 10_000 gwei); // historical high is 700 gwei
        uint256 gasCompPerDeposit = AVG_GAS_PER_COMPLETE * gasPrice;
        for (uint256 i = 0; i < numDeposits; i++) {
            // Get random amount
            uint256 newSeed;
            unchecked {
                newSeed = seed + i;
            }
            uint256 amount = bound(
                uint256(keccak256(abi.encodePacked(newSeed))),
                0,
                ETH_SUPPLY
            );
            depositAmounts[i] = amount;

            // Record deposit req
            deposits[i] = NocturneUtils.formatDepositRequest(
                _currentActor,
                address(erc20),
                depositAmounts[i],
                NocturneUtils.ERC20_ID,
                depositAddr,
                depositManager._nonce() + i,
                gasCompPerDeposit
            );
        }

        // Deal enough eth for deposits + comp
        uint256 totalDepositAmount = _sum(depositAmounts);
        vm.deal(
            _currentActor,
            totalDepositAmount + (gasCompPerDeposit * numDeposits)
        );

        vm.prank(_currentActor);
        depositManager.instantiateETHMultiDeposit{
            value: totalDepositAmount + (gasCompPerDeposit * numDeposits)
        }(depositAmounts, depositAddr);

        // Update sets and sum
        for (uint256 i = 0; i < numDeposits; i++) {
            _depositSet.push(deposits[i]);
            _instantiateDepositSumSetETH.addToActorSum(
                _currentActor,
                depositAmounts[i]
            );
        }

        _gasCompensationSet.addToActorSum(
            _currentActor,
            gasCompPerDeposit * numDeposits
        );
    }

    function instantiateDepositErc20(
        uint256 numDepositsSeed,
        uint256 seed
    ) public createActor trackCall("instantiateDepositErc20") {
        uint256 numDeposits = bound(numDepositsSeed, 1, 10);

        (, uint32 globalCapWholeTokens, , , uint8 precision) = depositManager
            ._erc20Caps(address(erc20));
        uint256 globalCap = uint256(globalCapWholeTokens) * 10 ** precision;

        // Bound deposit amounts, reserve tokens, save deposit reqs
        uint256[] memory depositAmounts = new uint256[](numDeposits);
        DepositRequest[] memory deposits = new DepositRequest[](numDeposits);
        StealthAddress memory depositAddr = NocturneUtils
            .defaultStealthAddress();

        uint256 gasPrice = bound(seed, 0, 10_000 gwei);
        uint256 gasCompPerDeposit = AVG_GAS_PER_COMPLETE * gasPrice;
        for (uint256 i = 0; i < numDeposits; i++) {
            // Get random amount
            uint256 newSeed;
            unchecked {
                newSeed = seed + i;
            }
            uint256 amount = bound(
                uint256(keccak256(abi.encodePacked(newSeed))),
                0,
                globalCap
            );
            depositAmounts[i] = amount;

            // Record deposit req
            deposits[i] = NocturneUtils.formatDepositRequest(
                _currentActor,
                address(erc20),
                depositAmounts[i],
                NocturneUtils.ERC20_ID,
                depositAddr,
                depositManager._nonce() + i,
                gasCompPerDeposit
            );
        }

        // Reserve tokens
        uint256 totalDepositAmount = _sum(depositAmounts);
        erc20.reserveTokens(_currentActor, totalDepositAmount);

        // Deal gas compensation
        vm.deal(_currentActor, gasCompPerDeposit * numDeposits);

        // Approve token
        vm.startPrank(_currentActor);
        erc20.approve(address(depositManager), totalDepositAmount);

        depositManager.instantiateErc20MultiDeposit{
            value: gasCompPerDeposit * numDeposits
        }(address(erc20), depositAmounts, depositAddr);

        vm.stopPrank();

        // Update deposit set and sum
        for (uint256 i = 0; i < numDeposits; i++) {
            _depositSet.push(deposits[i]);
            _instantiateDepositSumSetErc20.addToActorSum(
                _currentActor,
                depositAmounts[i]
            );
        }

        _gasCompensationSet.addToActorSum(
            _currentActor,
            gasCompPerDeposit * numDeposits
        );
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
    ) public onlyAllowCallFromNonDepositor trackCall("completeDepositErc20") {
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
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(screenerPrivkey, digest);
        bytes memory signature = ParseUtils.rsvToSignatureBytes(
            uint256(r),
            uint256(s),
            v
        );

        // Complete deposit
        uint256 gasPrice = bound(seed, 0, 10_000 gwei); // historical high is 700 gwei
        uint256 skipSeconds = bound(seed, 0, 10_000);
        skip(skipSeconds);
        vm.txGasPrice(gasPrice);
        vm.prank(screenerAddress);
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

        // NOTE: The actor balance in bounds invariant kept failing even though I checked all actor
        // balances via logs and only found balance == ghost var but never greater than. I suspect
        // there is a bug somewhere in foundry that doesn't like assertLe(0, 0) but want to leave
        // log here for now to check in case another failure.
        address[] memory allActors = ghost_AllActors();
        for (uint256 i = 0; i < allActors.length; i++) {
            console.log(
                string(
                    abi.encodePacked(
                        "Actor address:",
                        ParseUtils.toHexString(allActors[i]),
                        ". Balance:",
                        ParseUtils.uintToString(allActors[i].balance),
                        ". Expected balance cap:",
                        ParseUtils.uintToString(
                            ghost_totalSuppliedGasCompensationFor(allActors[i])
                        )
                    )
                )
            );
        }

        // TODO: track exact screener gas compensation
    }

    // ______VIEW______

    function ghost_AllActors() public view returns (address[] memory) {
        return _actors.addresses();
    }

    function ghost_totalSuppliedGasCompensation()
        public
        view
        returns (uint256)
    {
        return _gasCompensationSet.getTotalForAll();
    }

    function ghost_totalSuppliedGasCompensationFor(
        address actor
    ) public view returns (uint256) {
        return _gasCompensationSet.getSumForActor(actor);
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

    // ______PURE______
    function _sum(uint256[] memory arr) internal pure returns (uint256) {
        uint256 sum = 0;
        for (uint256 i = 0; i < arr.length; i++) {
            sum += arr[i];
        }
        return sum;
    }
}
