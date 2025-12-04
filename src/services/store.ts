import { addWallet, loadAll, removeWallet } from '../db/supabase.js';

export type WatchlistEntry = {
  address: string;
  name: string | null;
  chatId: number;
};

class WatchlistStore {
  private cache = new Map<string, Map<number, string | null>>();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    const rows = await loadAll();
    rows.forEach((row) => {
      const chatMap = this.cache.get(row.address) ?? new Map<number, string | null>();
      chatMap.set(row.chatId, row.name ?? null);
      this.cache.set(row.address, chatMap);
    });
    this.initialized = true;
  }

  getAll(): WatchlistEntry[] {
    const entries: WatchlistEntry[] = [];
    this.cache.forEach((chatMap, address) => {
      chatMap.forEach((name, chatId) => {
        entries.push({ address, name, chatId });
      });
    });
    return entries;
  }

  getByChat(chatId: number): WatchlistEntry[] {
    return this.getAll().filter((entry) => entry.chatId === chatId);
  }

  getWatchers(address: string): WatchlistEntry[] {
    const chatMap = this.cache.get(address.toLowerCase());
    if (!chatMap) return [];
    return Array.from(chatMap.entries()).map(([chatId, name]) => ({
      address: address.toLowerCase(),
      name,
      chatId,
    }));
  }

  getName(address: string): string | null | undefined {
    const chatMap = this.cache.get(address.toLowerCase());
    if (!chatMap || !chatMap.size) return undefined;
    const [, name] = chatMap.entries().next().value as [number, string | null];
    return name ?? null;
  }

  async add(address: string, name: string | null, chatId: number): Promise<void> {
    const lowerAddr = address.toLowerCase();
    await addWallet(lowerAddr, name, chatId);
    console.log(`加入监控：${lowerAddr}, ${chatId},${name}`)
    const chatMap = this.cache.get(lowerAddr) ?? new Map<number, string | null>();
    chatMap.set(chatId, name);
    this.cache.set(lowerAddr, chatMap);
  }

  async remove(address: string, chatId: number): Promise<void> {
    const lowerAddr = address.toLowerCase();
    await removeWallet(lowerAddr, chatId);
    const chatMap = this.cache.get(lowerAddr);
    if (chatMap) {
      chatMap.delete(chatId);
      if (!chatMap.size) {
        this.cache.delete(lowerAddr);
      }
    }
  }
}

export const watchlistStore = new WatchlistStore();
