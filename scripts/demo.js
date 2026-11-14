const hre = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const events = [];
const pause = () => new Promise(r => setTimeout(r, process.env.DEMO_SLOW === "1" ? 5000 : 0));
async function show(title, detail) {
  const event = { title, detail, time:new Date().toISOString() };
  events.push(event);
  console.log("\n"+title+"\n"+detail);
  await pause();
}
async function main() {
  if (!["hardhat","localhost"].includes(hre.network.name)) throw new Error("LOCAL_NETWORK_ONLY");
  await show("Educational simulation", "Local Hardhat EVM. Synthetic grain batches. No payments, tokens or real assets.");
  const [admin,custodian,sender,receiver,reviewer,outsider] = await hre.ethers.getSigners();
  const registry = await (await hre.ethers.getContractFactory("AgriChainRegistry")).deploy();
  await registry.waitForDeployment();
  for (const [name,signer] of [["CUSTODIAN",custodian],["SENDER",sender],["RECEIVER",receiver],["REVIEWER",reviewer]]) {
    await (await registry.grantRole(hre.ethers.id(name+"_ROLE"), signer.address)).wait();
  }
  await show("1. Contract deployed", `AgriChainRegistry: ${await registry.getAddress()}\nNetwork: ${hre.network.name}, chain ID 31337. Four separate business test accounts.`);
  await (await registry.connect(custodian).registerBatch("G001","Wheat",100000)).wait();
  assert.equal((await registry.getBatch("G001")).quantityKg,100000n);
  await show("2. Batch registered", "Custodian registers G001: Wheat, 100,000 kg. Status REGISTERED.");
  const hash = hre.ethers.id("synthetic-quality-document-v1");
  await (await registry.connect(custodian).addDocumentHash("G001",hash)).wait();
  assert.equal((await registry.getBatch("G001")).documentHash,hash);
  await show("3. Document fingerprint stored", `Fingerprint: ${hash}\nA changed file has a different hash. This does not certify the original document.`);
  await (await registry.connect(sender).dispatchBatch("G001")).wait();
  await show("4. Dispatch recorded", "Sender records dispatch. Status DISPATCHED.");
  await (await registry.connect(receiver).confirmReceipt("G001")).wait();
  assert.equal((await registry.getBatch("G001")).status,3n);
  await show("5. Receipt confirmed", "A different receiver account confirms receipt. Status RECEIVED.");
  let rejected = false;
  try { await registry.connect(custodian).splitBatch("G001","G001A",50000,"G001B",40000); }
  catch (e) { if (!String(e).includes("QUANTITY_MISMATCH")) throw e; rejected=true; }
  assert.equal(rejected,true);
  await show("6. Invalid split rejected", "50,000 + 40,000 does not equal 100,000 kg. Contract returns QUANTITY_MISMATCH.");
  await (await registry.connect(custodian).splitBatch("G001","G001A",50000,"G001B",50000)).wait();
  assert.equal((await registry.getBatch("G001A")).parentBatchId,"G001");
  assert.equal((await registry.getBatch("G001B")).quantityKg,50000n);
  await show("7. Valid split recorded", "G001A and G001B each contain 50,000 kg. Each child points to G001. Parent status SPLIT.");
  await (await registry.connect(reviewer).flagIssue("G001A","Synthetic document review")).wait();
  await (await registry.connect(reviewer).resolveIssue("G001A","Synthetic version checked")).wait();
  assert.equal((await registry.getBatch("G001A")).issueOpen,false);
  await show("8. Issue resolved", "Reviewer appends an issue and resolution. Event history remains available.");
  rejected=false;
  try { await registry.connect(outsider).registerBatch("UNAUTHORISED","Wheat",1); }
  catch(e) { if(!String(e).includes("ACCESS_DENIED")) throw e; rejected=true; }
  assert.equal(rejected,true);
  await show("9. Access control checked", "An unrelated test account cannot register a batch. Contract returns ACCESS_DENIED.");
  const evidence = path.join(__dirname,"..","evidence");
  fs.mkdirSync(evidence,{recursive:true});
  fs.writeFileSync(path.join(evidence,"demo-events.json"),JSON.stringify(events,null,2));
  console.log("\nDEMO PASSED: all state and rejection checks succeeded.");
}
main().catch(e=>{ console.error(e); process.exitCode=1; });
