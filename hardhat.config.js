require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");
// The pinned npm compiler makes compilation reproducible without a second download.
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(async ({ solcVersion }, hre, runSuper) => {
  if (solcVersion === "0.8.24") return {
    compilerPath: require.resolve("solc/soljson.js"), isSolcJs: true,
    version: "0.8.24", longVersion: require("solc").version()
  };
  return runSuper();
});
module.exports = {
  solidity: "0.8.24",
  networks: { hardhat: { chainId: 31337 }, localhost: { url: "http://127.0.0.1:8545", chainId: 31337 } }
};
