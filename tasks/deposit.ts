import * as dotenv from "dotenv";
import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
dotenv.config();

task("deposit", "Deposit amount of tokens to DAO contract")
  .addParam("contract", "DAO contract address")
  .addParam("amount", "amount to deposit")
  .setAction(async (taskArgs, hre) => {
    const DAO = await hre.ethers.getContractFactory("DAO");
    const dao = DAO.attach(taskArgs.contract);

    const transaction = await dao.deposit(taskArgs.amount);
    console.log(transaction);
  });
