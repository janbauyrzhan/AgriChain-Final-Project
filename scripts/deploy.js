const hre = require("hardhat");

async function main() {
  const [admin, custodian, sender, receiver, reviewer] = await hre.ethers.getSigners();
  const Factory = await hre.ethers.getContractFactory("AgriChainRegistry");
  const registry = await Factory.deploy();
  await registry.waitForDeployment();

  const roles = {
    CUSTODIAN_ROLE: await registry.CUSTODIAN_ROLE(),
    SENDER_ROLE: await registry.SENDER_ROLE(),
    RECEIVER_ROLE: await registry.RECEIVER_ROLE(),
    REVIEWER_ROLE: await registry.REVIEWER_ROLE()
  };
  await (await registry.grantRole(roles.CUSTODIAN_ROLE, custodian.address)).wait();
  await (await registry.grantRole(roles.SENDER_ROLE, sender.address)).wait();
  await (await registry.grantRole(roles.RECEIVER_ROLE, receiver.address)).wait();
  await (await registry.grantRole(roles.REVIEWER_ROLE, reviewer.address)).wait();

  console.log("AgriChainRegistry deployed:", await registry.getAddress());
  console.log("Admin:", admin.address);
  console.log("Synthetic test roles assigned to local accounts.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
