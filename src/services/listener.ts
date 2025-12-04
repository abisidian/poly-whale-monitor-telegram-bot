import { Contract, WebSocketProvider, type EventLog } from 'ethers';
import { watchlistStore } from './store.js';

const CTF_EXCHANGE_ADDRESS = '0x4d97dcd97ec945f40cf65f87097ace5ea0476045';
const CTF_ABI = [
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)',
];

export type TransferMatch = {
  type: 'single' | 'batch';
  operator: string;
  from: string;
  to: string;
  ids: bigint[];
  values: bigint[];
  watchers: { chatId: number; name: string | null }[];
  txHash: string;
  logIndex: number;
  blockNumber: number;
  blockTimestampMs: number | null;
};

type MatchHandler = (match: TransferMatch) => Promise<void> | void;

export class BlockchainListener {
  private provider: WebSocketProvider | null = null;
  private contract: Contract | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(
    private readonly wssUrl: string,
    private readonly onMatch: MatchHandler
  ) {
    if (!wssUrl) {
      throw new Error('POLYGON_WSS is not configured.');
    }
  }

  async start(): Promise<void> {
    this.stopped = false;
    await watchlistStore.init();
    await this.connect();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.removeContractListeners();
    if (this.provider) {
      await this.provider.destroy();
    }
    this.provider = null;
    this.contract = null;
  }

  private async connect(): Promise<void> {
    try {
      this.reconnectAttempts += 1;
      this.provider = new WebSocketProvider(this.wssUrl);
      this.contract = new Contract(CTF_EXCHANGE_ADDRESS, CTF_ABI, this.provider);
      this.attachEventHandlers();
      this.reconnectAttempts = 0;
      console.log(`[listener] connected to ${this.wssUrl}`);
    } catch (err) {
      console.error('[listener] failed to connect, will retry:', err);
      this.scheduleReconnect();
    }
  }

  private attachEventHandlers(): void {
    if (!this.contract || !this.provider) return;

    this.contract.on('TransferSingle', this.handleTransferSingle);
    this.contract.on('TransferBatch', this.handleTransferBatch);

    // Accessing the underlying websocket for close/error is not public API; guarded with any.
    const ws: any = (this.provider as any)?._websocket;
    if (ws?.on) {
      ws.on('close', (code: number) => {
        console.warn(`[listener] websocket closed (code: ${code}), scheduling reconnect`);
        this.scheduleReconnect();
      });
      ws.on('error', (err: unknown) => {
        console.error('[listener] websocket error, scheduling reconnect', err);
        this.scheduleReconnect();
      });
    }
  }

  private removeContractListeners(): void {
    if (this.contract) {
      this.contract.removeAllListeners('TransferSingle');
      this.contract.removeAllListeners('TransferBatch');
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.removeContractListeners();
    if (this.provider) {
      this.provider.destroy().catch(() => undefined);
      this.provider = null;
    }

    const delayMs = Math.min(30000, 1000 * 2 ** Math.min(this.reconnectAttempts, 5));
    console.warn(`[listener] reconnecting in ${delayMs}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delayMs);
  }

  private handleTransferSingle = async (
    operator: string,
    from: string,
    to: string,
    id: bigint,
    value: bigint,
    event: EventLog
  ): Promise<void> => {
    try {
      const { hash } = await event.getTransaction();
      const watchers = watchlistStore.getWatchers(to);
      if (!watchers.length || value <= 0n) return;
      const blockTimestampMs = await this.getBlockTimestampMs(event);
      await this.onMatch({
        type: 'single',
        operator,
        from,
        to: to.toLowerCase(),
        ids: [id],
        values: [value],
        watchers,
        txHash: hash,
        logIndex: event.index,
        blockNumber: event.blockNumber,
        blockTimestampMs,
      });
    } catch (err) {
      console.error('[listener] error handling TransferSingle:', err);
    }
  };

  private handleTransferBatch = async (
    operator: string,
    from: string,
    to: string,
    ids: bigint[],
    values: bigint[],
    event: EventLog
  ): Promise<void> => {
    try {
      const watchers = watchlistStore.getWatchers(to);
      if (!watchers.length) return;
      const hasPositive = values.some((v) => v > 0n);
      if (!hasPositive) return;
      const blockTimestampMs = await this.getBlockTimestampMs(event);
      await this.onMatch({
        type: 'batch',
        operator,
        from,
        to: to.toLowerCase(),
        ids,
        values,
        watchers,
        txHash: event.transactionHash,
        logIndex: event.index,
        blockNumber: event.blockNumber,
        blockTimestampMs,
      });
    } catch (err) {
      console.error('[listener] error handling TransferBatch:', err);
    }
  };

  private async getBlockTimestampMs(event: EventLog): Promise<number | null> {
    try {
      const block = await event.getBlock();
      const ts = block?.timestamp;
      if (ts === undefined || ts === null) return null;
      const value = typeof ts === 'bigint' ? Number(ts) : ts;
      if (!Number.isFinite(value)) return null;
      return value * 1000;
    } catch (err) {
      console.warn('[listener] failed to fetch block timestamp:', err);
      return null;
    }
  }
}
