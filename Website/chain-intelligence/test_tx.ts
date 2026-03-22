import { ethers } from 'ethers';

async function run() {
  try {
    const provider = ethers.getDefaultProvider("mainnet");
    const tx = await provider.getTransaction("0x51ab8fb2baeaeee302da40ba9cb086c59b207fe7cdad57451388d75cf701ed8a");
    console.log("Found TX:", tx ? tx.hash : "Not found");
    if (tx) {
        console.log("From:", tx.from, "To:", tx.to, "Value (ETH):", ethers.formatEther(tx.value || "0"));
    }
  } catch(e: any) { console.error(e.message); }
}
run();
