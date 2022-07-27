//SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "hardhat/console.sol";
import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract DAO is AccessControl {
    address public token;
    
    uint256 public votingPeriod;
    uint256 public minQuorum;
    uint256 public numProposals = 1;

    bytes32 public constant CHAIRMAN_ROLE = keccak256("CHAIRMAN_ROLE");

    struct Vote {
        uint256 weight;
        uint256 decision;
    }

    struct Proposal {
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 startingTime;
        address target;
        bool active;
        string description;
        bytes callData;
    }

    mapping(address => uint256) public balances;
    mapping(address => uint256) public withdrawLock;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => Vote)) public votes;

    event NewProposal(
        uint256 indexed proposalId, 
        address indexed creator, 
        string description, 
        address indexed target
    );

    event Deposit(address indexed from, uint256 amount);
    event Withdraw(address indexed to, uint256 amount);

    event Voted(
        uint256 indexed proposalId, 
        address indexed voter, 
        uint256 decision
    );

    event VotingFinished(uint256 indexed proposalId, bool success);

    constructor(address _token, uint256 _votingPeriod, uint256 _minQuorum) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        grantRole(CHAIRMAN_ROLE, msg.sender);
        grantRole(DEFAULT_ADMIN_ROLE, address(this));
        _revokeRole(DEFAULT_ADMIN_ROLE, msg.sender);
        token = _token;
        votingPeriod = _votingPeriod * 1 days;
        minQuorum = _minQuorum;
    }

    function deposit(uint256 amount) public {
        require(amount > 0, "Must be at least 1 Wei");

        IERC20(token).transferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;

        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount) public {
        require(withdrawLock[msg.sender] < block.timestamp, "Voting is not over");
        require(balances[msg.sender] >= amount, "Insufficient balance");

        IERC20(token).transfer(msg.sender, amount);
        balances[msg.sender] -= amount;

        emit Withdraw(msg.sender, amount);
    }

    function addProposal(
        address target, 
        bytes memory callData, 
        string memory description
    ) 
        public 
        onlyRole(CHAIRMAN_ROLE)
        returns (uint256 proposalId) 
    {
        proposalId = numProposals++;
        Proposal storage prop = proposals[proposalId];
        prop.target = target;
        prop.callData = callData;
        prop.description = description;
        prop.active = true;
        prop.startingTime = block.timestamp;

        emit NewProposal(proposalId, msg.sender, description, target);
    }

    function vote(uint256 proposalId, uint256 decision) public {
        require(decision == 0 || decision == 1, "Only 0 or 1 is allowed");
        require(balances[msg.sender] > 0, "Insufficient balance");

        Proposal storage prop = proposals[proposalId];
        require(block.timestamp < prop.startingTime + votingPeriod, "The voting is over");

        Vote storage v = votes[proposalId][msg.sender];    
        require(v.weight == 0, "You can vote only once");

        uint256 weight = balances[msg.sender];

        if (decision == 1) {
            v.weight = weight;
            prop.votesFor += weight;
        } else {
            v.weight = weight;
            prop.votesAgainst += weight;
        }

        v.decision = decision;
        withdrawLock[msg.sender] = prop.startingTime + votingPeriod;

        emit Voted(proposalId, msg.sender, decision);
    }

    function finish(uint256 proposalId) public {
        Proposal storage prop = proposals[proposalId];
        require(prop.active, "The voting is over");
        require(block.timestamp >= prop.startingTime + votingPeriod, "The voting is not over yet");

        prop.active = false;
        uint256 votesFor = prop.votesFor;
        uint256 votesAgainst = prop.votesAgainst;

        if ((votesFor + votesAgainst) >= (minQuorum) 
            && votesFor > votesAgainst) {
            (bool success,) = prop.target.call(prop.callData);
            emit VotingFinished(proposalId, success);
        } else {
            emit VotingFinished(proposalId, false);
        }
    }
}
