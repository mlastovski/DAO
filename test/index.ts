import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { parseEther } from "ethers/lib/utils";

describe("DAO", function () {
  let DAO: ContractFactory;
  let Token: ContractFactory;
  let dao: Contract;
  let token: Contract;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let callData: string;

  const votingPeriod = 1;
  const minQuorum = 10000;
  const description = "description";
  const days = 86400;

  const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero;
  const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
  const BURNER_ROLE = "0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848";
  const CHAIRMAN_ROLE = "0xdc1958ce1178d6eb32ccc146dcea8933f1978155832913ec88fa509962e1b413";

  before(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    DAO = await ethers.getContractFactory("DAO");
    Token = await ethers.getContractFactory("Token");

    callData = Token.interface.encodeFunctionData("grantMinter", [addr2.address]);
  });

  beforeEach(async function () {
    token = await Token.deploy("Crypton", "CRT");
    await token.deployed();

    dao = await DAO.deploy(token.address, votingPeriod, minQuorum);
    await dao.deployed();

    await token.grantRole(MINTER_ROLE, owner.address);
    await token.grantRole(BURNER_ROLE, owner.address);

    await token.mint(owner.address, parseEther("6000"));
    await token.mint(addr1.address, parseEther("6000"));
    await token.mint(addr2.address, parseEther("6000"));

    await token.initialize(dao.address);
  });

  describe("Deployment", function () {
    it("dao: Should set correct DAO contract address", async function () {
      expect(await token.dao()).to.equal(dao.address);
    })

    it("token: Should set correct token contract address", async function () {
      expect(await dao.token()).to.equal(token.address);
    });

    it("votingPeriod: Should set correct votingPeriod", async function () {
      expect(await dao.votingPeriod()).to.equal(86400);
    });

    it("minQuorum: Should set correct minQuorum", async function () {
      expect(await dao.minQuorum()).to.equal(minQuorum);
    });
  });

  describe("Ownership", function () {
    it("hasRole: DAO should have DEFAULT_ADMIN_ROLE in Token contract", async function () {
      expect(await token.hasRole(DEFAULT_ADMIN_ROLE, dao.address)).to.equal(true);
    });

    it("hasRole: DAO should be self-admin", async function () {
      expect(await dao.hasRole(DEFAULT_ADMIN_ROLE, dao.address)).to.equal(true);
    });

    it("hasRole: Should fail to addProposal (missing role CHAIRMAN_ROLE)", async function () {
      await expect(dao.connect(addr1).addProposal(
        token.address, callData, description))
        .to.be.revertedWith(
          "AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8" + 
          " is missing role 0xdc1958ce1178d6eb32ccc146dcea8933f1978155832913ec88fa509962e1b413");
    });
  });

  describe("Info", function () {
    beforeEach(async function () {
      await dao.addProposal(token.address, callData, description);
      await dao.addProposal(token.address, callData, description);
      await dao.addProposal(token.address, callData, description);
      await dao.addProposal(token.address, callData, description);
      await dao.addProposal(token.address, callData, description);

      await token.approve(dao.address, parseEther("100"));
      await dao.deposit(parseEther("100"));
      await token.connect(addr1).approve(dao.address, parseEther("100"));
      await dao.connect(addr1).deposit(parseEther("100"));
    });

    it("balances: Should get the deposit balance of an owner", async function () {
      expect(await dao.balances(owner.address)).to.equal(parseEther("100"));
    });

    // TODO view functions test
  });

  describe("deposit", function () {
    it("Should deposit properly", async function () {
      await token.approve(dao.address, parseEther("50"));
      await dao.deposit(parseEther("50"));
      expect(await dao.balances(owner.address)).to.equal(parseEther("50"));
    });

    it("Should fail to deposit (Must be at least 1 Wei)", async function () {
      await token.approve(dao.address, parseEther("50"));
      await expect(dao.deposit(parseEther("0"))).to.be.revertedWith("Must be at least 1 Wei");
    });
  });

  describe("withdraw", function () {
    beforeEach(async function () {
      await token.approve(dao.address, parseEther("50"));
      await dao.deposit(parseEther("50"));
    });

    it("Should withdraw properly", async function () {
      await dao.withdraw(parseEther("50"));
      expect(await dao.balances(owner.address)).to.equal(parseEther("0"));
    });

    it("Should fail to withdraw (Insufficient balance)", async function () {
      await expect(dao.withdraw(parseEther("51"))).to.be.revertedWith("Insufficient balance");
    });

    it("Should fail to withdraw (Voting is not over)", async function () {
      await dao.addProposal(token.address, callData, description);
      await dao.vote(1, 0);
      await expect(dao.withdraw(parseEther("50"))).to.be.revertedWith("Voting is not over");
    });
  });

  describe("addProposal", function () {
    it("Should add proposal", async function () {
      expect(await dao.addProposal(token.address, callData, description))
      .to.emit(dao, "NewProposal")
      .withArgs(1, owner.address, description, token.address);
    });
  });

  describe("vote", function () {
    beforeEach(async function () {
      await dao.addProposal(token.address, callData, description);
      await dao.addProposal(token.address, callData, description);

      await token.approve(dao.address, parseEther("100"));
      await dao.deposit(parseEther("100"));
      await token.connect(addr1).approve(dao.address, parseEther("100"));
      await dao.connect(addr1).deposit(parseEther("100"));
    });

    it("Should vote properly (decision 0)", async function () {
      expect(await dao.vote(1, 0))
      .to.emit(dao, "Voted")
      .withArgs(1, owner.address, 0);
    });

    it("Should vote properly (decision 1)", async function () {
      expect(await dao.vote(1, 1))
      .to.emit(dao, "Voted")
      .withArgs(1, owner.address, 1);

      await ethers.provider.send('evm_increaseTime', [0.5 * days]);
      await ethers.provider.send('evm_mine', []);

      expect(await dao.vote(2, 1))
      .to.emit(dao, "Voted")
      .withArgs(2, owner.address, 1);
    });

    it("Should fail to vote (Insufficient balance)", async function () {
      await dao.withdraw(parseEther("100"));
      await expect(dao.vote(1, 0)).to.be.revertedWith("Insufficient balance");
    });

    it("Should fail to vote (Only 0 or 1 is allowed)", async function () {
      await expect(dao.vote(1, 2)).to.be.revertedWith("Only 0 or 1 is allowed");
    });

    it("Should fail to vote (The voting is over)", async function () {
      await ethers.provider.send('evm_increaseTime', [2 * days]);
      await ethers.provider.send('evm_mine', []);
      await expect(dao.vote(1, 1)).to.be.revertedWith("The voting is over");
    });

    it("Should fail to vote (You can vote only once)", async function () {
      await dao.vote(1, 1);
      await expect(dao.vote(1, 1)).to.be.revertedWith("You can vote only once");
    });
  });
});