const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer account configured. Set DEPLOYER_PRIVATE_KEY in .env.");
  }

  const configuredProjectOwner = process.env.PROJECT_OWNER_ADDRESS || deployer.address;
  if (!hre.ethers.isAddress(configuredProjectOwner)) {
    throw new Error("PROJECT_OWNER_ADDRESS must be a valid EVM address when set.");
  }

  const network = await hre.ethers.provider.getNetwork();
  console.log(`Deploying ArqisInvoiceRegistry to ${hre.network.name} (chainId ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Project owner: ${configuredProjectOwner}`);

  const Registry = await hre.ethers.getContractFactory("ArqisInvoiceRegistry");
  const registry = await Registry.deploy(configuredProjectOwner);
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  const deploymentTx = registry.deploymentTransaction();

  console.log(`ArqisInvoiceRegistry: ${address}`);
  console.log(`Deployment tx: ${deploymentTx && deploymentTx.hash}`);

  const out = {
    contract: "ArqisInvoiceRegistry",
    network: hre.network.name,
    chainId: Number(network.chainId),
    address,
    deployer: deployer.address,
    projectOwner: configuredProjectOwner,
    deploymentTx: deploymentTx && deploymentTx.hash,
    deployedAt: new Date().toISOString(),
    purpose: "Non-custodial invoice/payment-reference proof registry for the Arqis testnet MVP"
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  fs.writeFileSync(path.join(deploymentsDir, `${hre.network.name}.json`), JSON.stringify(out, null, 2) + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
