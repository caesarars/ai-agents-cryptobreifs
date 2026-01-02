import Fastify from 'fastify';
import { config } from './config.js';
import { registerRoutes } from './api/routes.js';
import { TelegramDispatcher } from './api/telegramDispatcher.js';
import { MarketDataService } from './market/marketData.js';
import { RuleEngine } from './rule/ruleEngine.js';
import { CandleStore } from './store/candleStore.js';
import { InMemoryStore } from './store/inMemoryStore.js';
import type { AlertEvent, NotificationLog, Timeframe, TriggeredAlert } from './types/domain.js';
import { newId } from './utils/ids.js';

const app = Fastify({ logger: { level: config.logLevel } });
const store = new InMemoryStore();
const candleStore = new CandleStore();
const ruleEngine = new RuleEngine(store, candleStore);
const dispatcher = new TelegramDispatcher();

const handleTriggeredAlerts = async (
  alerts: TriggeredAlert[],
  events: AlertEvent[]
) => {
  await Promise.all(
    alerts.map(async (alert, index) => {
      const event = events[index];
      store.addAlert(event);
      try {
        await dispatcher.dispatch({ rule: alert.rule, user: alert.user, payload: event.payload });
        const notification: NotificationLog = {
          id: newId(),
          alertEventId: event.id,
          ruleId: alert.rule.id,
          userId: alert.user.id,
          channel: 'TELEGRAM',
          status: 'SENT',
          sentAt: new Date()
        };
        store.addNotification(notification);
        app.log.info({ ruleId: alert.rule.id }, 'Alert dispatched');
      } catch (error) {
        const notification: NotificationLog = {
          id: newId(),
          alertEventId: event.id,
          ruleId: alert.rule.id,
          userId: alert.user.id,
          channel: 'TELEGRAM',
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error),
          sentAt: new Date()
        };
        store.addNotification(notification);
        app.log.error({ err: error, ruleId: alert.rule.id }, 'Failed to dispatch alert');
      }
    })
  );
};

const marketData = new MarketDataService((candle) => {
  if (!candle.isFinal) return;

  const triggered = ruleEngine.evaluateCandle(candle);
  const extremeTriggered = candle.interval === '1m' ? ruleEngine.evaluateExtremeMove(candle) : [];
  const allTriggered = [...triggered, ...extremeTriggered];

  if (allTriggered.length === 0) return;

  const events = allTriggered.map((alert) => ({
    id: newId(),
    ruleId: alert.rule.id,
    userId: alert.user.id,
    symbol: alert.rule.symbol,
    type: alert.rule.type,
    triggeredAt: new Date(),
    payload: alert.payload
  } satisfies AlertEvent));

  void handleTriggeredAlerts(allTriggered, events);
});

const reconcileSubscriptions = () => {
  const rules = store.listRules();
  const targets = new Set<string>();

  for (const rule of rules) {
    const timeframe: Timeframe = rule.type === 'EXTREME_MOVE' ? '1m' : (rule.timeframe ?? '1m');
    targets.add(`${rule.symbol}:${timeframe}`);
  }

  for (const target of targets) {
    const [symbol, timeframe] = target.split(':') as [string, Timeframe];
    marketData.subscribe(symbol, timeframe);
  }
};

await registerRoutes(app, store);

app.addHook('onReady', async () => {
  reconcileSubscriptions();
  setInterval(reconcileSubscriptions, 30_000).unref();
});

app.listen({ port: config.port, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
