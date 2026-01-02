import WebSocket from 'ws';
import type { Candle, Timeframe } from '../types/domain.js';

export type CandleHandler = (candle: Candle) => void;

const intervals: Timeframe[] = ['1m', '5m', '15m'];

export class MarketDataService {
  private sockets = new Map<string, WebSocket>();

  constructor(private readonly onCandle: CandleHandler) {}

  subscribe(symbol: string, interval: Timeframe): void {
    const key = `${symbol.toLowerCase()}@kline_${interval}`;
    if (this.sockets.has(key)) return;

    const socket = new WebSocket(`wss://stream.binance.com:9443/ws/${key}`);
    socket.on('message', (data) => {
      const parsed = JSON.parse(data.toString()) as {
        k: {
          t: number;
          T: number;
          s: string;
          i: Timeframe;
          o: string;
          h: string;
          l: string;
          c: string;
          v: string;
          x: boolean;
        };
      };

      const candle: Candle = {
        symbol: parsed.k.s,
        interval: parsed.k.i,
        openTime: parsed.k.t,
        closeTime: parsed.k.T,
        open: Number(parsed.k.o),
        high: Number(parsed.k.h),
        low: Number(parsed.k.l),
        close: Number(parsed.k.c),
        volume: Number(parsed.k.v),
        isFinal: parsed.k.x
      };

      this.onCandle(candle);
    });

    socket.on('close', () => {
      this.sockets.delete(key);
    });

    socket.on('error', () => {
      socket.close();
    });

    this.sockets.set(key, socket);
  }

  subscribeDefaults(symbols: string[]): void {
    for (const symbol of symbols) {
      for (const interval of intervals) {
        this.subscribe(symbol, interval);
      }
    }
  }
}
