import 'dotenv/config';
import { watchlistStore } from '../services/store.js';
import { BlockchainListener, type TransferMatch } from '../services/listener.js';

async function main() {
  const wssUrl = process.env.POLYGON_WSS;
  const listener = new BlockchainListener(wssUrl ?? '', async (match: TransferMatch) => {
    console.log('[match]', {
      to: match.to,
      watchers: match.watchers.map((w) => ({ chatId: w.chatId, name: w.name })),
      type: match.type,
      ids: match.ids.map(String),
      values: match.values.map((v) => v.toString()),
      txHash: match.txHash,
      blockNumber: match.blockNumber,
      logIndex: match.logIndex,
      blockTimestampMs: match.blockTimestampMs,
    });
  });

  await watchlistStore.init();
  const entries = watchlistStore.getAll();
  console.log(`[listener-demo] watchlist loaded: ${entries.length} addresses`);
  if (!entries.length) {
    console.warn('[listener-demo] watchlist is empty; add addresses to see matches');
  }

  await listener.start();
  console.log('[listener-demo] listening for TransferSingle/TransferBatch...');
}

main().catch((err) => {
  console.error('[listener-demo] failed:', err);
  process.exit(1);
});
