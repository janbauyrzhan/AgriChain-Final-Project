const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgriChainRegistry", function () {
  let registry, admin, custodian, sender, receiver, reviewer, outsider;
  const CUSTODIAN = ethers.keccak256(ethers.toUtf8Bytes("CUSTODIAN_ROLE"));
  const SENDER = ethers.keccak256(ethers.toUtf8Bytes("SENDER_ROLE"));
  const RECEIVER = ethers.keccak256(ethers.toUtf8Bytes("RECEIVER_ROLE"));
  const REVIEWER = ethers.keccak256(ethers.toUtf8Bytes("REVIEWER_ROLE"));
  const hash1 = ethers.keccak256(ethers.toUtf8Bytes("synthetic-quality-document-v1"));

  beforeEach(async function () {
    [admin, custodian, sender, receiver, reviewer, outsider] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("AgriChainRegistry");
    registry = await Factory.deploy();
    await registry.waitForDeployment();
    await (await registry.grantRole(CUSTODIAN, custodian.address)).wait();
    await (await registry.grantRole(SENDER, sender.address)).wait();
    await (await registry.grantRole(RECEIVER, receiver.address)).wait();
    await (await registry.grantRole(REVIEWER, reviewer.address)).wait();
  });

  async function createAndReceive(id = "G001") {
    await (await registry.connect(custodian).registerBatch(id, "Wheat", 100000)).wait();
    await (await registry.connect(sender).dispatchBatch(id)).wait();
    await (await registry.connect(receiver).confirmReceipt(id)).wait();
  }

  it("allows an authorised custodian to register a batch", async function () {
    await registry.connect(custodian).registerBatch("G001", "Wheat", 100000);
    const b = await registry.getBatch("G001");
    expect(b.quantityKg).to.equal(100000n);
    expect(b.status).to.equal(1n);
  });

  it("rejects an unauthorised batch registration", async function () {
    await expect(registry.connect(outsider).registerBatch("G002", "Wheat", 500))
      .to.be.revertedWith("ACCESS_DENIED");
  });

  it("rejects duplicate batch identifiers", async function () {
    await registry.connect(custodian).registerBatch("G001", "Wheat", 1000);
    await expect(registry.connect(custodian).registerBatch("G001", "Wheat", 1000))
      .to.be.revertedWith("BATCH_EXISTS");
  });

  it("records dispatch and requires the receiver role for receipt", async function () {
    await registry.connect(custodian).registerBatch("G001", "Wheat", 1000);
    await registry.connect(sender).dispatchBatch("G001");
    await expect(registry.connect(sender).confirmReceipt("G001"))
      .to.be.revertedWith("ACCESS_DENIED");
    await registry.connect(receiver).confirmReceipt("G001");
    expect((await registry.getBatch("G001")).status).to.equal(3n);
  });

  it("stores a document fingerprint and rejects an empty hash", async function () {
    await registry.connect(custodian).registerBatch("G001", "Wheat", 1000);
    await registry.connect(custodian).addDocumentHash("G001", hash1);
    expect((await registry.getBatch("G001")).documentHash).to.equal(hash1);
    await expect(registry.connect(custodian).addDocumentHash("G001", ethers.ZeroHash))
      .to.be.revertedWith("EMPTY_HASH");
  });

  it("splits a received batch only when child quantities equal the parent", async function () {
    await createAndReceive("G001");
    await expect(registry.connect(custodian).splitBatch("G001", "G001A", 50000, "G001B", 40000))
      .to.be.revertedWith("QUANTITY_MISMATCH");
    await registry.connect(custodian).splitBatch("G001", "G001A", 50000, "G001B", 50000);
    const parent = await registry.getBatch("G001");
    const child = await registry.getBatch("G001A");
    expect(parent.status).to.equal(4n);
    expect(child.quantityKg).to.equal(50000n);
    expect(child.parentBatchId).to.equal("G001");
  });

  it("allows a reviewer to flag and resolve an issue without deleting the batch", async function () {
    await registry.connect(custodian).registerBatch("G001", "Wheat", 1000);
    await registry.connect(reviewer).flagIssue("G001", "Synthetic quantity mismatch");
    expect((await registry.getBatch("G001")).issueOpen).to.equal(true);
    await registry.connect(reviewer).resolveIssue("G001", "Synthetic records reconciled");
    const b = await registry.getBatch("G001");
    expect(b.issueOpen).to.equal(false);
    expect(b.batchId).to.equal("G001");
  });

  it("does not allow a non-reviewer to resolve an issue", async function () {
    await registry.connect(custodian).registerBatch("G001", "Wheat", 1000);
    await registry.connect(reviewer).flagIssue("G001", "Review required");
    await expect(registry.connect(outsider).resolveIssue("G001", "Resolved"))
      .to.be.revertedWith("ACCESS_DENIED");
  });
});
