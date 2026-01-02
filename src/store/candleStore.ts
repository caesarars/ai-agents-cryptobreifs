import type { Candle, Timeframe } from '../types/domain.js';

const makeKey = (symbol: string, interval: Timeframe) => `${symbol}:${interval}`;

export class CandleStore {
  private candles = new Map<string, Candle[]>();

  add(candle: Candle, max = 500): void {
    const key = makeKey(candle.symbol, candle.interval);
    const list = this.candles.get(key) ?? [];
    list.push(candle);
    if (list.length > max) {
      list.splice(0, list.length - max);
    }
    this.candles.set(key, list);
  }

  get(symbol: string, interval: Timeframe): Candle[] {
    return this.candles.get(makeKey(symbol, interval)) ?? [];
  }
}
