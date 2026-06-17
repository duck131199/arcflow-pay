const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("ArqisInvoiceRegistry", function () {
  const USDC = "0x3600000000000000000000000000000000000000";

  async function deployFixture() {
    const [seller, payer, stranger] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("ArqisInvoiceRegistry");
    const registry = await Registry.deploy(seller.address);
    await registry.waitForDeployment();

    const invoiceId = ethers.id("ARQIS-TEST-INVOICE-001");
    const memoHash = ethers.id("Test invoice memo");
    const amount = ethers.parseUnits("12.34", 6);
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const expiresAt = now + 24 * 60 * 60;

    return { registry, seller, payer, stranger, invoiceId, memoHash, amount, expiresAt };
  }

  it("sets the project owner at deployment", async function () {
    const { registry, seller } = await deployFixture();
    expect(await registry.projectOwner()).to.equal(seller.address);
  });

  it("rejects zero project owner at deployment", async function () {
    const Registry = await ethers.getContractFactory("ArqisInvoiceRegistry");
    await expect(Registry.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(Registry, "InvalidProjectOwner");
  });

  it("creates an invoice proof record", async function () {
    const { registry, seller, payer, invoiceId, memoHash, amount, expiresAt } = await deployFixture();

    await expect(registry.createInvoice(invoiceId, payer.address, USDC, amount, memoHash, expiresAt))
      .to.emit(registry, "InvoiceCreated")
      .withArgs(invoiceId, seller.address, payer.address, USDC, amount, memoHash, expiresAt, await anyTimestamp());

    const invoice = await registry.getInvoice(invoiceId);
    expect(invoice.seller).to.equal(seller.address);
    expect(invoice.payer).to.equal(payer.address);
    expect(invoice.token).to.equal(USDC);
    expect(invoice.amount).to.equal(amount);
    expect(invoice.memoHash).to.equal(memoHash);
    expect(invoice.paymentRecorded).to.equal(false);
  });

  it("rejects duplicate invoice ids", async function () {
    const { registry, payer, invoiceId, memoHash, amount, expiresAt } = await deployFixture();

    await registry.createInvoice(invoiceId, payer.address, USDC, amount, memoHash, expiresAt);

    await expect(registry.createInvoice(invoiceId, payer.address, USDC, amount, memoHash, expiresAt))
      .to.be.revertedWithCustomError(registry, "InvoiceAlreadyExists")
      .withArgs(invoiceId);
  });

  it("rejects invalid invoice fields", async function () {
    const { registry, payer, invoiceId, memoHash, amount, expiresAt } = await deployFixture();

    await expect(registry.createInvoice(invoiceId, ethers.ZeroAddress, USDC, amount, memoHash, expiresAt))
      .to.be.revertedWithCustomError(registry, "InvalidPayer");

    await expect(registry.createInvoice(invoiceId, payer.address, ethers.ZeroAddress, amount, memoHash, expiresAt))
      .to.be.revertedWithCustomError(registry, "InvalidToken");

    await expect(registry.createInvoice(invoiceId, payer.address, USDC, 0, memoHash, expiresAt))
      .to.be.revertedWithCustomError(registry, "InvalidAmount");

    await expect(registry.createInvoice(invoiceId, payer.address, USDC, amount, memoHash, 1))
      .to.be.revertedWithCustomError(registry, "InvalidExpiry");
  });

  it("lets the seller record a payment reference", async function () {
    const { registry, seller, payer, invoiceId, memoHash, amount, expiresAt } = await deployFixture();
    const paymentTxHash = ethers.id("payment-tx-hash");

    await registry.createInvoice(invoiceId, payer.address, USDC, amount, memoHash, expiresAt);

    await expect(registry.recordPayment(invoiceId, paymentTxHash))
      .to.emit(registry, "PaymentRecorded")
      .withArgs(invoiceId, paymentTxHash, seller.address, await anyTimestamp());

    const invoice = await registry.getInvoice(invoiceId);
    expect(invoice.paymentTxHash).to.equal(paymentTxHash);
    expect(invoice.paymentRecorded).to.equal(true);
  });

  it("lets the payer record a payment reference", async function () {
    const { registry, payer, invoiceId, memoHash, amount, expiresAt } = await deployFixture();
    const paymentTxHash = ethers.id("payer-payment-tx-hash");

    await registry.createInvoice(invoiceId, payer.address, USDC, amount, memoHash, expiresAt);
    await expect(registry.connect(payer).recordPayment(invoiceId, paymentTxHash))
      .to.emit(registry, "PaymentRecorded");
  });

  it("rejects payment recording from unrelated wallets or duplicates", async function () {
    const { registry, stranger, payer, invoiceId, memoHash, amount, expiresAt } = await deployFixture();
    const paymentTxHash = ethers.id("payment-tx-hash");

    await registry.createInvoice(invoiceId, payer.address, USDC, amount, memoHash, expiresAt);

    await expect(registry.connect(stranger).recordPayment(invoiceId, paymentTxHash))
      .to.be.revertedWithCustomError(registry, "NotInvoiceParty")
      .withArgs(invoiceId, stranger.address);

    await expect(registry.recordPayment(invoiceId, ethers.ZeroHash))
      .to.be.revertedWithCustomError(registry, "InvalidPaymentTxHash");

    await registry.recordPayment(invoiceId, paymentTxHash);

    await expect(registry.recordPayment(invoiceId, ethers.id("second-payment")))
      .to.be.revertedWithCustomError(registry, "PaymentAlreadyRecorded")
      .withArgs(invoiceId);
  });

  async function anyTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp + 1;
  }
});
