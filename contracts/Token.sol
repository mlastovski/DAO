// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Token is ERC20, AccessControl {
    uint256 numMinters;
    uint256 numBurners;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE  = keccak256("BURNER_ROLE");

    address public dao;

    event MinterGranted(address indexed caller, address account);
    event MinterRevoked(address indexed caller, address account);
    event BurnerGranted(address indexed caller, address account);
    event BurnerRevoked(address indexed caller, address account);


    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function initialize(address _dao) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(DEFAULT_ADMIN_ROLE, msg.sender);
        dao = _dao;
        _setupRole(DEFAULT_ADMIN_ROLE, _dao);
    }

    function grantMinter(address to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MINTER_ROLE, to);
        numMinters++;
        emit MinterGranted(msg.sender, to);
    }

    function revokeMinter(address from) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(numMinters > 1, "Should be at least 1");
        _revokeRole(MINTER_ROLE, from);
        numMinters--;
        emit MinterRevoked(msg.sender, from);
    }

    function grantBurner(address to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(BURNER_ROLE, to);
        numBurners++;
        emit BurnerGranted(msg.sender, to);
    }

    function revokeBurner(address from) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(numBurners > 1, "Should be at least 1");
        _revokeRole(BURNER_ROLE, from);
        numBurners--;
        emit BurnerRevoked(msg.sender, from);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(from, amount);
    }
}
