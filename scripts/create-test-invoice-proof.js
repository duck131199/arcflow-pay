const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";

async function main() {
  const deploymentPath = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found: ${deploymentPath}`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const [seller, payerFallback] = await hre.ethers.getSigners();
  if (!seller) {
    throw new Error("No signer configured. Set DEPLOYER_PRIVATE_KEY in .env.");
  }

  const payer = process.env.TEST_PAYER_ADDRESS || (payerFallback && payerFallback.address) || seller.address;
  const invoiceRef = process.env.TEST_INVOICE_REF || `ARQIS-TEST-${Date.now()}`;
  const memo = process.env.TEST_MEMO || "Arqis test invoice proof";
  const amount = hre.ethers.parseUnits(process.env.TEST_AMOUNT_USDC || "1.00", 6);
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

  const invoiceId = hre.ethers.id(invoiceRef);
  const memoHash = hre.ethers.id(memo);

  const registry = await hre.ethers.getContractAt("ArqisInvoiceRegistry", deployment.address);

  console.log(`Creating test invoice proof on ${hre.network.name}`);
  console.log(`Registry: ${deployment.address}`);
  console.log(`Seller: ${seller.address}`);
  console.log(`Payer: ${payer}`);
  console.log(`Invoice ref: ${invoiceRef}`);
  console.log(`Invoice id: ${invoiceId}`);

  const tx = await registry.createInvoice(invoiceId, payer, ARC_TESTNET_USDC, amount, memoHash, expiresAt);
  const receipt = await tx.wait();

  console.log(`createInvoice tx: ${receipt.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
