import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_KEY. Please set them in .env.');
}

export type MonitoredWallet = {
  address: string;
  name: string | null;
  chatId: number;
  created_at?: string;
};

export const supabaseClient: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function loadAll(): Promise<MonitoredWallet[]> {
  const { data, error } = await supabaseClient
    .from('monitored_wallets')
    .select('address, name, chat_id, created_at');

  if (error) {
    throw new Error(`Failed to load monitored_wallets: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    address: row.address.toLowerCase(),
    name: row.name ?? null,
    chatId: normalizeChatId(row.chat_id),
    created_at: row.created_at,
  }));
}

export async function addWallet(address: string, name: string | null, chatId: number): Promise<void> {
  const lowerAddr = address.toLowerCase();
  const { error } = await supabaseClient
    .from('monitored_wallets')
    .upsert({ address: lowerAddr, name, chat_id: chatId }, { onConflict: 'address,chat_id' });

  if (error) {
    throw new Error(`Failed to add wallet ${lowerAddr}: ${error.message}`);
  }
}

export async function removeWallet(address: string, chatId: number): Promise<void> {
  const lowerAddr = address.toLowerCase();
  const { error } = await supabaseClient
    .from('monitored_wallets')
    .delete()
    .eq('address', lowerAddr)
    .eq('chat_id', chatId);

  if (error) {
    throw new Error(`Failed to remove wallet ${lowerAddr} for chat ${chatId}: ${error.message}`);
  }
}

function normalizeChatId(raw: unknown): number {
  const value = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error('Invalid chat_id from Supabase; expected finite number');
  }
  return value;
}
