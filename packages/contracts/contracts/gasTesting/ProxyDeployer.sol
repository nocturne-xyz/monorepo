//SPDX-License-Identifier: Unlicense
pragma solidity 0.7.6;

import "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol";

contract ProxyDeployer {
    constructor() {}

    function initialize(address dummy) external {}

    function createProxy(address impl, address admin)
        external
        returns (address)
    {
        return
            address(
                new TransparentUpgradeableProxy(
                    impl,
                    admin,
                    abi.encodeWithSignature(
                        "initialize(address)",
                        address(this)
                    )
                )
            );
    }
}
