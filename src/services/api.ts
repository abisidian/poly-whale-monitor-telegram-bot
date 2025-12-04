import axios from 'axios';

const ACTIVITY_URL = 'https://data-api.polymarket.com/activity';
const DEFAULT_LIMIT = 25;
const INITIAL_DELAY_MS = 5000;
const RETRY_DELAY_MS = 5000;
const MAX_RETRIES = 10;

export type PolymarketActivity = {
  proxyWallet: string;
  timestamp: number;
  conditionId?: string;
  type: string;
  size?: number;
  usdcSize?: number;
  transactionHash?: string;
  price?: number;
  asset?: string;
  side?: 'BUY' | 'SELL' | string;
  outcomeIndex?: number;
  title?: string;
  slug?: string;
  eventSlug?: string;
  outcome?: string;
  name?: string;
  pseudonym?: string;
  profileImage?: string;
  profileImageOptimized?: string;
  [key: string]: unknown;
};

export async function fetchActivity(
  address: string,
  limit = DEFAULT_LIMIT,
  offset = 0
): Promise<PolymarketActivity[]> {
  const user = address.toLowerCase();
  try {
    const { data } = await axios.get<PolymarketActivity[]>(ACTIVITY_URL, {
      params: { user, limit, offset },
      timeout: 10_000,
    });

    if (!Array.isArray(data)) {
      throw new Error('Unexpected activity response format');
    }
    return data;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch activity for ${user}: ${reason}`);
  }
}

export async function processTrade(
  address: string,
  txHash: string | null,
  timestamp: number | null
): Promise<PolymarketActivity | null> {
  await sleep(INITIAL_DELAY_MS);
  const lowerAddress = address.toLowerCase();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const activities = await fetchActivity(lowerAddress);
    const candidate = pickTradeCandidate(activities, txHash);
    if (candidate) return candidate;

    if (attempt < MAX_RETRIES - 1) {
      await sleep(RETRY_DELAY_MS);
    }
  }

  return null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickTradeCandidate(
  activities: PolymarketActivity[],
  txHash: string | null
): PolymarketActivity | null {
  const trades = activities
    .filter((item) => item && typeof item === 'object')
    .filter((item) => item.type?.toUpperCase() === 'TRADE' && item.side?.toUpperCase() === 'BUY')
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  if (!trades.length) return null;

  const normalizedTxHash = txHash?.toLowerCase() ?? null;

  const txMatched = trades.find((trade) => {
    if (!normalizedTxHash) return false;
    const tradeTx = trade.transactionHash?.toLowerCase();
    if (!tradeTx) return false;
    return tradeTx === normalizedTxHash;
  });
  if (txMatched) return txMatched;
  return null;
}
