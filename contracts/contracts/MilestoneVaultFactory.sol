// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MilestoneVault.sol";

contract MilestoneVaultFactory {
    address public arbiter;
    address[] public allVaults;

    mapping(address => address[]) private _investorVaults;
    mapping(address => address[]) private _builderVaults;

    event VaultCreated(
        address indexed vault,
        address indexed investor,
        address indexed builder
    );

    constructor(address _arbiter) {
        require(_arbiter != address(0), "Factory: zero arbiter address");
        arbiter = _arbiter;
    }

    /// @notice Create a new MilestoneVault agreement. Caller becomes investor.
    function createAgreement(
        address _builder,
        string[] calldata _milestoneDescriptions,
        uint256[] calldata _milestonePercentages
    ) external returns (address) {
        require(_builder != address(0), "Factory: zero builder address");
        require(_builder != msg.sender, "Factory: builder cannot be investor");

        MilestoneVault vault = new MilestoneVault(
            msg.sender,
            _builder,
            arbiter,
            _milestoneDescriptions,
            _milestonePercentages
        );

        address vaultAddress = address(vault);
        allVaults.push(vaultAddress);
        _investorVaults[msg.sender].push(vaultAddress);
        _builderVaults[_builder].push(vaultAddress);

        emit VaultCreated(vaultAddress, msg.sender, _builder);
        return vaultAddress;
    }

    function getInvestorVaults(address investor) external view returns (address[] memory) {
        return _investorVaults[investor];
    }

    function getBuilderVaults(address builder_) external view returns (address[] memory) {
        return _builderVaults[builder_];
    }

    function getAllVaults() external view returns (address[] memory) {
        return allVaults;
    }

    function getVaultCount() external view returns (uint256) {
        return allVaults.length;
    }
}
