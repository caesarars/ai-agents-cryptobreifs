export type Plan = 'FREE' | 'PRO';

export type AlertType = 'EXTREME_MOVE' | 'BREAKOUT' | 'VOLUME_SPIKE';

export type Timeframe = '1m' | '5m' | '15m';

export interface User {
  id: string;
  email?: string;
  telegramChatId: string;
  plan: Plan;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertRule {
  id: string;
  userId: string;
  symbol: string;
  type: AlertType;
  timeframe: Timeframe | null;
  params: ExtremeMoveParams | BreakoutParams | VolumeSpikeParams;
  isEnabled: boolean;
  cooldownSec: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  userId: string;
  symbol: string;
  type: AlertType;
  triggeredAt: Date;
  payload: Record<string, unknown>;
}

export interface NotificationLog {
  id: string;
  alertEventId: string;
  ruleId: string;
  userId: string;
  channel: 'TELEGRAM';
  status: 'SENT' | 'FAILED';
  error?: string;
  sentAt: Date;
}

export interface Candle {
  symbol: string;
  interval: Timeframe;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isFinal: boolean;
}

export interface ExtremeMoveParams {
  windowMin: number;
  percent: number;
  direction: 'UP' | 'DOWN' | 'BOTH';
}

export interface BreakoutParams {
  lookback: number;
  direction: 'UP' | 'DOWN' | 'BOTH';
}

export interface VolumeSpikeParams {
  lookback: number;
  multiplier: number;
}

export interface TriggeredAlert {
  rule: AlertRule;
  user: User;
  payload: Record<string, unknown>;
}
