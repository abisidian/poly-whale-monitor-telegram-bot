import TelegramBot, { type SendMessageOptions } from 'node-telegram-bot-api';
import { getAddress, isAddress } from 'ethers';
import { watchlistStore } from './store.js';

let botInstance: TelegramBot | null = null;

export async function startBot(): Promise<TelegramBot> {
  if (botInstance) return botInstance;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('缺少 TELEGRAM_BOT_TOKEN，请在 .env 中配置');
  }

  await watchlistStore.init();

  const bot = new TelegramBot(token, { polling: true });
  botInstance = bot;

  registerHandlers(bot);

  bot
    .setMyCommands([
      { command: 'start', description: '显示使用说明' },
      { command: 'add', description: '添加监控地址: /add <address> [备注]' },
      { command: 'remove', description: '移除监控地址: /remove <address>' },
      { command: 'list', description: '查看当前监控列表' },
    ])
    .catch((err: unknown) => console.warn('[bot] 设置命令列表失败:', err));

  bot.on('polling_error', (err: unknown) => {
    console.error('[bot] polling error:', err);
  });

  console.log('[bot] Telegram 机器人已启动 (polling)');
  return bot;
}

export function notifyUser(
  chatId: number | string,
  message: string,
  options: SendMessageOptions = {}
): Promise<TelegramBot.Message> {
  const bot = getBot();
  const merged: SendMessageOptions = {
    parse_mode: 'HTML',
    disable_web_page_preview: false,
    ...options,
  };
  return bot.sendMessage(chatId, message, merged);
}

function registerHandlers(bot: TelegramBot): void {
  bot.onText(/^\/start\b/i, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const text = [
      '👋 欢迎使用 Polymarket 监控机器人。',
      '可用指令：',
      '/add <地址> [备注] - 添加监控地址',
      '/remove <地址> - 移除监控地址',
      '/list - 查看当前监控列表',
    ].join('\n');
    await bot.sendMessage(chatId, text);
  });

  bot.onText(/^\/add\s+([^\s]+)(?:\s+(.+))?$/i, async (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
    const chatId = msg.chat.id;
    const address = match?.[1]?.trim();
    const alias = match?.[2]?.trim();

    if (!address || !isAddress(address)) {
      await bot.sendMessage(chatId, '❌ 地址格式不正确，请输入有效的 EVM 地址。');
      return;
    }

    try {
      const normalized = normalizeAddress(address);
      await watchlistStore.add(normalized, alias || null, chatId);
      await bot.sendMessage(
        chatId,
        `✅ 已添加监控：<code>${normalized}</code>${alias ? `（${escapeHtml(alias)}）` : ''}`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await bot.sendMessage(chatId, `❌ 添加失败：${reason}`);
    }
  });

  bot.onText(
    /^\/remove\s+([^\s]+)\s*$/i,
    async (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
    const chatId = msg.chat.id;
    const address = match?.[1]?.trim();
    if (!address || !isAddress(address)) {
      await bot.sendMessage(chatId, '❌ 地址格式不正确，请输入有效的 EVM 地址。');
      return;
    }

    try {
      const normalized = normalizeAddress(address);
      await watchlistStore.remove(normalized, chatId);
      await bot.sendMessage(chatId, `✅ 已移除监控：<code>${normalized}</code>`, { parse_mode: 'HTML' });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await bot.sendMessage(chatId, `❌ 移除失败：${reason}`);
    }
  });

  bot.onText(/^\/list\b/i, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const entries = watchlistStore.getByChat(chatId);
    if (!entries.length) {
      await bot.sendMessage(chatId, '当前监控列表为空，使用 /add <地址> 添加。');
      return;
    }

    const lines = entries.map((item, idx) => {
      const alias = item.name ? ` - ${escapeHtml(item.name)}` : '';
      return `${idx + 1}. <code>${item.address}</code>${alias}`;
    });

    await bot.sendMessage(chatId, ['📋 监控列表：', ...lines].join('\n'), { parse_mode: 'HTML' });
  });
}

function normalizeAddress(address: string): string {
  return getAddress(address).toLowerCase();
}

function getBot(): TelegramBot {
  if (!botInstance) {
    throw new Error('Telegram Bot 尚未初始化，请先调用 startBot()');
  }
  return botInstance;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
