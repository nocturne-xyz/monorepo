//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.5;
pragma abicoder v2;

import "./IWallet.sol";

interface IVault {
    function requestERC20s(
        address[] calldata assetAddresses,
        uint256[] calldata values
    ) external;

    function requestERC721(address assetAddress, uint256 id) external;

    function requestERC1155(
        address assetAddress,
        uint256 id,
        uint256 value
    ) external;

    function approveFunds(
        uint256[] calldata values,
        address[] calldata assets
    ) external;

    function makeBatchDeposit(
        IWallet.Deposit[] calldata deposits,
        uint256 numApprovedDeposits
    ) external returns (uint256[] memory, uint256);

    function makeDeposit(
        IWallet.Deposit calldata deposit
    ) external returns (bool);
}
