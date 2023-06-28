// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import {Pairing} from "./libs/Pairing.sol";
import {Groth16} from "./libs/Groth16.sol";
import {IJoinSplitVerifier} from "./interfaces/IJoinSplitVerifier.sol";

contract JoinSplitVerifier is IJoinSplitVerifier {
    function verifyingKey()
        internal
        pure
        returns (Groth16.VerifyingKey memory vk)
    {
        vk.alpha1 = Pairing.G1Point(
            20491192805390485299153009773594534940189261866228447918068658471970481763042,
            9383485363053290200918347156157836566562967994039712273449902621266178545958
        );

        vk.beta2 = Pairing.G2Point(
            [
                4252822878758300859123897981450591353533073413197771768651442665752259397132,
                6375614351688725206403948262868962793625744043794305715222011528459656738731
            ],
            [
                21847035105528745403288232691147584728191162732299865338377159692350059136679,
                10505242626370262277552901082094356697409835680220590971873171140371331206856
            ]
        );
        vk.gamma2 = Pairing.G2Point(
            [
                11559732032986387107991004021392285783925812861821192530917403151452391805634,
                10857046999023057135944570762232829481370756359578518086990519993285655852781
            ],
            [
                4082367875863433681332203403145435568316851327593401208105741076214120093531,
                8495653923123431417604973247489272438418190587263600148770280649306958101930
            ]
        );
        vk.delta2 = Pairing.G2Point(
            [
                11988873432341564707583151905171536697369040712080288258682225249680671247248,
                16425737254716080932469244840097357488032781585354276885172317126054819860226
            ],
            [
                11596398603562216329757052051523871682238725341879438216244994854033180106614,
                17668194111687975515334230327804777447867823873805601222208963004030159693766
            ]
        );
        vk.IC = new Pairing.G1Point[](13);

        vk.IC[0] = Pairing.G1Point(
            14427466768100110149618207443470923198647525620875790199396080659804518398463,
            17634628749519980739854007324950895433292162043300062931262713762762649084481
        );
        vk.IC[1] = Pairing.G1Point(
            12737946490888197098037283231075030292743654019993345829272247562888275016360,
            17692101105856707860439861834703601136274828765268938516770224297494456862702
        );
        vk.IC[2] = Pairing.G1Point(
            1495089139234767516934403461028356593465283302927261311264915456084728763821,
            13297096623157508495250151019781616462229333911326148408283519871707874721633
        );
        vk.IC[3] = Pairing.G1Point(
            15504801271222415405959702963489649332722947300640766945927920407220895093324,
            3801548328855655959497471151067139962378605530862944586070564302804305435608
        );
        vk.IC[4] = Pairing.G1Point(
            19715596755586060010298761064021427885532298894029522611161191983625803861590,
            12823206819258052677580503014740573206886904076336355702075683789823686203721
        );
        vk.IC[5] = Pairing.G1Point(
            2838113599379462211215578993245857154827665474164382141859709736343615129943,
            4435484160738221246900976392415516545575989578388861194682094037836251373001
        );
        vk.IC[6] = Pairing.G1Point(
            8093741340744845814358422952059026174830266038021019130640314561725784968495,
            4690560589672750599072770339654636736777942131249629419621040585326466452880
        );
        vk.IC[7] = Pairing.G1Point(
            16337873346567548757550643708020986970400887717577960518580914530739974179656,
            13013341233545365356321474801856927521422976396002309468790429739313479733994
        );
        vk.IC[8] = Pairing.G1Point(
            4112880940255450911840166582953406669672944036650611626591680635147539936040,
            14314211396530520867661905481293594757075028042036848258733853933373843745109
        );
        vk.IC[9] = Pairing.G1Point(
            2990986556986562535614986277504696254730538434258112245938204326235277104810,
            1027905818517166310242997438066515132260353446405243549717922406623451248889
        );
        vk.IC[10] = Pairing.G1Point(
            19386995408000896250638596407187117385140012429645316481258866016550363900994,
            5344927028546909098081729453376835973173916750561810237217726880416991365190
        );
        vk.IC[11] = Pairing.G1Point(
            4740813588430427156750742982309717276304216410363562088027074602182013003691,
            10738748922141202079433562514401737492700578187070680120349499571433704304912
        );
        vk.IC[12] = Pairing.G1Point(
            13896769193419913752674846244053568634732630317787854370300384778503274381843,
            4697334298099330510565865769508043731648807318467477755653108759201084436232
        );
    }

    /// @return r  bool true if proof is valid
    function verifyProof(
        uint256[8] memory proof,
        uint256[] memory pi
    ) public view override returns (bool r) {
        return Groth16.verifyProof(verifyingKey(), proof, pi);
    }

    /// @return r bool true if proofs are valid
    function batchVerifyProofs(
        uint256[8][] memory proofs,
        uint256[][] memory allPis
    ) public view override returns (bool) {
        return Groth16.batchVerifyProofs(verifyingKey(), proofs, allPis);
    }
}
