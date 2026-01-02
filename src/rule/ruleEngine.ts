import type {
  AlertRule,
  Candle,
  TriggeredAlert,
  ExtremeMoveParams,
  BreakoutParams,
  VolumeSpikeParams
} from '../types/domain.js';
import { newId } from '../utils/ids.js';
import type { CandleStore } from '../store/candleStore.js';
import type { InMemoryStore } from '../store/inMemoryStore.js';

export class RuleEngine {
  constructor(
    private readonly store: InMemoryStore,
    private readonly candleStore: CandleStore
  ) {}

  evaluateCandle(candle: Candle): TriggeredAlert[] {
    this.candleStore.add(candle);
    const rules = this.store
      .listRules()
      .filter(
        (rule) =>
          rule.isEnabled &&
          rule.symbol === candle.symbol &&
          rule.timeframe === candle.interval
      );

    const triggered: TriggeredAlert[] = [];

    for (const rule of rules) {
      if (!this.canTrigger(rule)) continue;

      if (rule.type === 'BREAKOUT') {
        const params = rule.params as BreakoutParams;
        const result = this.checkBreakout(rule, params, candle);
        if (result) triggered.push(result);
      }

      if (rule.type === 'VOLUME_SPIKE') {
        const params = rule.params as VolumeSpikeParams;
        const result = this.checkVolumeSpike(rule, params, candle);
        if (result) triggered.push(result);
      }
    }

    return triggered;
  }

  evaluateExtremeMove(candle: Candle): TriggeredAlert[] {
    const rules = this.store
      .listRules()
      .filter(
        (rule) =>
          rule.isEnabled && rule.symbol === candle.symbol && rule.type === 'EXTREME_MOVE'
      );

    const triggered: TriggeredAlert[] = [];
    for (const rule of rules) {
      if (!this.canTrigger(rule)) continue;
      const params = rule.params as ExtremeMoveParams;
      const result = this.checkExtremeMove(rule, params, candle);
      if (result) triggered.push(result);
    }

    return triggered;
  }

  private checkBreakout(
    rule: AlertRule,
    params: BreakoutParams,
    candle: Candle
  ): TriggeredAlert | null {
    const history = this.candleStore.get(rule.symbol, candle.interval);
    if (history.length < params.lookback + 1) return null;

    const window = history.slice(-params.lookback - 1, -1);
    const highest = Math.max(...window.map((item) => item.high));
    const lowest = Math.min(...window.map((item) => item.low));

    const brokeUp = candle.close > highest;
    const brokeDown = candle.close < lowest;

    if (
      (params.direction === 'UP' && !brokeUp) ||
      (params.direction === 'DOWN' && !brokeDown) ||
      (params.direction === 'BOTH' && !brokeUp && !brokeDown)
    ) {
      return null;
    }

    this.markTriggered(rule);

    const user = this.store.getUser(rule.userId);
    if (!user) return null;

    return {
      rule,
      user,
      payload: {
        id: newId(),
        type: 'BREAKOUT',
        symbol: rule.symbol,
        timeframe: rule.timeframe,
        close: candle.close,
        highest,
        lowest,
        direction: brokeUp ? 'UP' : 'DOWN',
        triggeredAt: new Date().toISOString()
      }
    };
  }

  private checkVolumeSpike(
    rule: AlertRule,
    params: VolumeSpikeParams,
    candle: Candle
  ): TriggeredAlert | null {
    const history = this.candleStore.get(rule.symbol, candle.interval);
    if (history.length < params.lookback + 1) return null;

    const window = history.slice(-params.lookback - 1, -1);
    const avgVolume =
      window.reduce((sum, item) => sum + item.volume, 0) / window.length;

    if (candle.volume < avgVolume * params.multiplier) {
      return null;
    }

    this.markTriggered(rule);

    const user = this.store.getUser(rule.userId);
    if (!user) return null;

    return {
      rule,
      user,
      payload: {
        id: newId(),
        type: 'VOLUME_SPIKE',
        symbol: rule.symbol,
        timeframe: rule.timeframe,
        volume: candle.volume,
        avgVolume,
        multiplier: params.multiplier,
        triggeredAt: new Date().toISOString()
      }
    };
  }

  private checkExtremeMove(
    rule: AlertRule,
    params: ExtremeMoveParams,
    candle: Candle
  ): TriggeredAlert | null {
    const history = this.candleStore.get(rule.symbol, '1m');
    if (history.length === 0) return null;

    const windowMs = params.windowMin * 60 * 1000;
    const cutoff = candle.closeTime - windowMs;
    const previous = [...history]
      .reverse()
      .find((item) => item.closeTime <= cutoff);

    if (!previous) return null;

    const change = ((candle.close - previous.close) / previous.close) * 100;
    const up = change >= params.percent;
    const down = change <= -params.percent;

    if (
      (params.direction === 'UP' && !up) ||
      (params.direction === 'DOWN' && !down) ||
      (params.direction === 'BOTH' && !up && !down)
    ) {
      return null;
    }

    this.markTriggered(rule);

    const user = this.store.getUser(rule.userId);
    if (!user) return null;

    return {
      rule,
      user,
      payload: {
        id: newId(),
        type: 'EXTREME_MOVE',
        symbol: rule.symbol,
        windowMin: params.windowMin,
        percent: params.percent,
        change,
        price: candle.close,
        triggeredAt: new Date().toISOString()
      }
    };
  }

  private canTrigger(rule: AlertRule): boolean {
    const last = this.store.getCooldown(rule.id);
    if (!last) return true;
    return Date.now() - last >= rule.cooldownSec * 1000;
  }

  private markTriggered(rule: AlertRule): void {
    this.store.setCooldown(rule.id, Date.now());
  }
}
