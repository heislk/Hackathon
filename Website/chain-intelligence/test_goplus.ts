import { queryChainIntelligence } from './src/index';

async function run() {
  const result = await queryChainIntelligence('0x733EA491051929d0b6619425e088d210deB5cBE6');
  console.log(JSON.stringify(result, null, 2));
}

run();
