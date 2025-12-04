import 'dotenv/config';
import { watchlistStore } from '../services/store.js';

async function main() {
  const sampleAddress = '0x' + 'a1'.repeat(20); // 0xa1a1...
  const alias = `demo-${Date.now()}`;
  const chatId = 123456;

  await watchlistStore.init();
  console.log('Initial entries:', watchlistStore.getAll());

  await watchlistStore.add(sampleAddress, alias, chatId);
  console.log('After add:', watchlistStore.getAll());

  const found = watchlistStore.getWatchers(sampleAddress);
  console.log('Lookup watchers:', found);

  await watchlistStore.remove(sampleAddress, chatId);
  console.log('After remove:', watchlistStore.getAll());
}

main().catch((err) => {
  console.error('Store test failed:', err);
  process.exit(1);
});
