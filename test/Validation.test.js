const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgriChain validation and event history", function () {
  let registry, admin, custodian, sender, receiver, reviewer, outsider;
  beforeEach(async function () {
    [admin, custodian, sender, receiver, reviewer, outsider] = await ethers.getSigners();
    registry = await (await ethers.getContractFactory("AgriChainRegistry")).deploy();
    await registry.waitForDeployment();
    for (const [name, signer] of [["CUSTODIAN",custodian],["SENDER",sender],["RECEIVER",receiver],["REVIEWER",reviewer]]) {
      await (await registry.grantRole(ethers.id(name+"_ROLE"), signer.address)).wait();
    }
  });
  async function received() {
    await registry.connect(custodian).registerBatch("G001", "Wheat", 100000);
    await registry.connect(sender).dispatchBatch("G001");
    await registry.connect(receiver).confirmReceipt("G001");
  }
  it("rejects an outsider attempting to grant a business role", async function () {
    await expect(registry.connect(outsider).grantRole(ethers.id("SENDER_ROLE"), outsider.address)).to.be.revertedWith("ACCESS_DENIED");
  });
  it("rejects granting a role to the zero address", async function () {
    await expect(registry.grantRole(ethers.id("SENDER_ROLE"), ethers.ZeroAddress)).to.be.revertedWith("ZERO_ADDRESS");
  });
  it("rejects empty batch identifiers and zero quantities", async function () {
    await expect(registry.connect(custodian).registerBatch("", "Wheat", 10)).to.be.revertedWith("EMPTY_BATCH_ID");
    await expect(registry.connect(custodian).registerBatch("G001", "Wheat", 0)).to.be.revertedWith("ZERO_QUANTITY");
  });
  it("rejects receipt before dispatch", async function () {
    await registry.connect(custodian).registerBatch("G001", "Wheat", 10);
    await expect(registry.connect(receiver).confirmReceipt("G001")).to.be.revertedWith("INVALID_STATUS");
  });
  it("rejects an empty child ID and keeps parent and children unchanged", async function () {
    await received();
    await expect(registry.connect(custodian).splitBatch("G001","G001A",50000,"",50000)).to.be.revertedWith("EMPTY_BATCH_ID");
    expect((await registry.getBatch("G001")).status).to.equal(3n);
    await expect(registry.getBatch("G001A")).to.be.revertedWith("BATCH_NOT_FOUND");
  });
  it("rejects duplicate child IDs and a second split", async function () {
    await received();
    await expect(registry.connect(custodian).splitBatch("G001","A",50000,"A",50000)).to.be.revertedWith("DUPLICATE_CHILD_ID");
    await registry.connect(custodian).splitBatch("G001","A",50000,"B",50000);
    await expect(registry.connect(custodian).splitBatch("G001","C",50000,"D",50000)).to.be.revertedWith("PARENT_NOT_RECEIVED");
  });
  it("preserves both document hash events when the current fingerprint changes", async function () {
    await registry.connect(custodian).registerBatch("G001","Wheat",10);
    const first = ethers.id("synthetic-v1"), second = ethers.id("synthetic-v2");
    await expect(registry.connect(custodian).addDocumentHash("G001",first)).to.emit(registry,"DocumentHashAdded").withArgs("G001",first,custodian.address);
    await expect(registry.connect(custodian).addDocumentHash("G001",second)).to.emit(registry,"DocumentHashAdded").withArgs("G001",second,custodian.address);
    expect((await registry.getBatch("G001")).documentHash).to.equal(second);
    expect((await registry.queryFilter(registry.filters.DocumentHashAdded())).length).to.equal(2);
    await expect(registry.connect(outsider).addDocumentHash("G001",first)).to.be.revertedWith("ACCESS_DENIED");
  });
});
