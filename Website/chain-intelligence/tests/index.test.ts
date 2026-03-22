import { queryChainIntelligence } from '../src/index';

async function runTests() {
  console.log('--- Running Chain Intelligence Tests ---\n');

  try {
    // 1. ETH Address
    console.log('[Test 1] ETH Address: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    const ethData = await queryChainIntelligence({ inputType: 'address', value: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' });
    if (ethData) {
      console.log(`Detected Chain: ${ethData.query.detectedChain}`);
      console.log(`ETH Balance: ${ethData.assets[0]?.balance || '0'}`);
      console.log(`Providers Used: ${ethData.provenance.providersUsed.join(', ')}\n`);
    }

    // 2. BTC Address
    console.log('[Test 2] BTC Address: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    const btcData = await queryChainIntelligence({ inputType: 'address', value: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' });
    if (btcData) {
      console.log(`Detected Chain: ${btcData.query.detectedChain}`);
      console.log(`BTC Balance: ${btcData.assets[0]?.balance || '0'}`);
      console.log(`Providers Used: ${btcData.provenance.providersUsed.join(', ')}\n`);
    }

    // 3. EVM Tx Hash
    console.log('[Test 3] EVM Tx Hash: 0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060');
    const evmTx = await queryChainIntelligence({ inputType: 'txhash', value: '0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060' });
    if (evmTx) {
      console.log(`Detected Chain: ${evmTx.query.detectedChain}`);
      console.log(`Providers Used: ${evmTx.provenance.providersUsed.join(', ')}\n`);
    }

    // 4. BTC Tx Hash
    console.log('[Test 4] BTC Tx Hash: f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16');
    const btcTx = await queryChainIntelligence({ inputType: 'txhash', value: 'f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16' });
    if (btcTx) {
      console.log(`Detected Chain: ${btcTx.query.detectedChain}`);
      console.log(`Providers Used: ${btcTx.provenance.providersUsed.join(', ')}\n`);
    }

    // 5. Invalid Input / Unknown
    console.log('[Test 5] Unknown/Invalid Input Format (testing fallback)');
    const unknownData = await queryChainIntelligence({ inputType: 'address', value: 'UnknownStringThatLooksLikeNothing' });
    if (unknownData) {
      console.log(`Detected Chain: ${unknownData.query.detectedChain}`);
      console.log(`Providers Used: ${unknownData.provenance.providersUsed.join(', ')}\n`);
    }

  } catch (err: any) {
    console.error('Test failed with error:', err.message);
  }
}

runTests();
