import 'dotenv/config';
import { startBot, notifyUser } from './services/bot.js';
import { watchlistStore } from './services/store.js';
import { BlockchainListener, type TransferMatch } from './services/listener.js';
import { formatActivityMessage } from './utils/formatter.js';
import { processTrade } from './services/api.js';

async function main(): Promise<void> {
  await watchlistStore.init();
  const bot = await startBot();

  const wssUrl = process.env.POLYGON_WSS;
  if (!wssUrl) {
    throw new Error('缺少 POLYGON_WSS，请在 .env 中配置 Polygon WSS 节点');
  }

  const listener = new BlockchainListener(wssUrl, async (match: TransferMatch) => {
    try {
      const activity = await processTrade(match.to, match.txHash, match.blockTimestampMs);
      if (!activity) {
        console.warn('[handler] 未匹配到对应交易，可能是 API 未更新或非 BUY/TRADE：', match.txHash);
        return;
      }

      const baseInfo = { address: match.to, txHash: match.txHash };

      for (const watcher of match.watchers) {
        const message = formatActivityMessage(activity, {
          ...baseInfo,
          alias: watcher.name ?? null,
        });
        await notifyUser(watcher.chatId, message);
      }
    } catch (err) {
      console.error('[handler] 处理链上事件失败:', err);
    }
  });

  await listener.start();
  console.log('[main] 监听已启动，Bot 已就绪。');

  bot.on('error', (err) => console.error('[bot] runtime error:', err));
}

main().catch((err) => {
  console.error('启动失败：', err);
  process.exit(1);
});
