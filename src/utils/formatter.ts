import { type PolymarketActivity } from '../services/api.js';

type FormatOptions = {
  alias?: string | null;
  address?: string;
  txHash?: string | null;
  locale?: string;
};

export function formatActivityMessage(activity: PolymarketActivity, options: FormatOptions = {}): string {
  const { alias, address, txHash, locale = 'zh-CN' } = options;
  const profileAddress = (address ?? activity.proxyWallet)?.toLowerCase();
  const shortAddr = shortenAddress(profileAddress);
  const userLabel = alias ? `${alias} (${shortAddr})` : shortAddr;
  const eventUrl = buildEventUrl(activity);
  const profileUrl = profileAddress ? `https://polymarket.com/profile/${profileAddress}` : null;
  const txUrl = null; // 不展示区块浏览器链接

  const lines = [
    '<b>🚨 Polymarket 监控提醒</b>',
    `👤 <b>用户</b>：${escapeHtml(userLabel)}`,
    `🛒 <b>操作</b>：${formatSide(activity.side)}`,
    `📅 <b>预测事件</b>：${escapeHtml(activity.title ?? '未知事件')}`,
    `🎯 <b>下注结果</b>：${escapeHtml(activity.outcome ?? '未知')}`,
    `💰 <b>投入金额</b>：$${formatCurrency(activity.usdcSize ?? activity.size)}`,
    `📊 <b>成交均价</b>：$${formatPrice(activity.price)}`,
    `⏰ <b>时间</b>：${formatTimestamp(activity.timestamp, locale)}`,
  ];

  if (profileUrl || eventUrl) {
    const linkParts = [];
    if (profileUrl) linkParts.push(`<a href="${profileUrl}">用户主页</a>`);
    if (eventUrl) linkParts.push(`<a href="${eventUrl}">事件页面</a>`);
    lines.push(`🔗 ${linkParts.join(' | ')}`);
  }

  return lines.join('\n');
}

function formatCurrency(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPrice(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  return value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function formatTimestamp(timestamp: number | undefined, locale: string): string {
  const ms = normalizeTimestampMs(timestamp);
  if (ms === null) return '-';
  return new Date(ms).toLocaleString(locale, { hour12: false, timeZone: 'UTC' });
}

function formatSide(side?: string): string {
  const upper = side?.toUpperCase();
  if (upper === 'BUY') return '买入 (BUY)';
  if (upper === 'SELL') return '卖出 (SELL)';
  return '未知';
}

function shortenAddress(addr?: string | null): string {
  if (!addr) return '-';
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function buildEventUrl(activity: PolymarketActivity): string | null {
  const slug = activity.slug;
  const eventSlug = activity.eventSlug;
  if (!slug || !eventSlug) return null;
  return `https://polymarket.com/event/${eventSlug}/${slug}`;
}

function normalizeTimestampMs(timestamp?: number | null): number | null {
  if (timestamp === undefined || timestamp === null) return null;
  if (!Number.isFinite(timestamp)) return null;
  return timestamp > 1_000_000_000_000 ? Math.floor(timestamp) : Math.floor(timestamp * 1000);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
