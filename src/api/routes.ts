import type { FastifyInstance } from 'fastify';
import type { InMemoryStore } from '../store/inMemoryStore.js';
import type { AlertRule, AlertType, Timeframe } from '../types/domain.js';
import { config } from '../config.js';

const isAlertType = (value: string): value is AlertType =>
  value === 'EXTREME_MOVE' || value === 'BREAKOUT' || value === 'VOLUME_SPIKE';

const isTimeframe = (value: string): value is Timeframe =>
  value === '1m' || value === '5m' || value === '15m';

export const registerRoutes = async (
  app: FastifyInstance,
  store: InMemoryStore
): Promise<void> => {
  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/users', async () => ({ users: store.listUsers() }));

  app.post('/users', async (request, reply) => {
    const body = request.body as {
      email?: string;
      telegramChatId: string;
      plan?: 'FREE' | 'PRO';
    };

    if (!body.telegramChatId) {
      return reply.status(400).send({ error: 'telegramChatId is required' });
    }

    const user = store.createUser({
      email: body.email,
      telegramChatId: body.telegramChatId,
      plan: body.plan ?? 'FREE'
    });

    return reply.status(201).send(user);
  });

  app.get('/rules', async () => ({ rules: store.listRules() }));

  app.post('/rules', async (request, reply) => {
    const body = request.body as Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>;

    if (!body.userId || !body.symbol || !body.type) {
      return reply.status(400).send({ error: 'userId, symbol, type are required' });
    }

    if (!isAlertType(body.type)) {
      return reply.status(400).send({ error: 'Invalid rule type' });
    }

    if (body.timeframe && !isTimeframe(body.timeframe)) {
      return reply.status(400).send({ error: 'Invalid timeframe' });
    }

    const user = store.getUser(body.userId);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const maxRules = user.plan === 'PRO' ? config.maxRulesPro : config.maxRulesFree;
    const activeRules = store
      .listRules()
      .filter((rule) => rule.userId === user.id).length;
    if (activeRules >= maxRules) {
      return reply.status(403).send({ error: 'Rule limit exceeded' });
    }

    const rule = store.createRule({
      userId: body.userId,
      symbol: body.symbol,
      type: body.type,
      timeframe: body.timeframe ?? null,
      params: body.params,
      isEnabled: body.isEnabled ?? true,
      cooldownSec: body.cooldownSec ?? 900
    });

    return reply.status(201).send(rule);
  });

  app.patch('/rules/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as Partial<AlertRule>;
    const rule = store.updateRule(id, updates);
    if (!rule) return reply.status(404).send({ error: 'Rule not found' });
    return reply.send(rule);
  });

  app.delete('/rules/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const removed = store.deleteRule(id);
    if (!removed) return reply.status(404).send({ error: 'Rule not found' });
    return reply.status(204).send();
  });

  app.get('/alerts', async () => ({ alerts: store.listAlerts() }));

  app.get('/notifications', async () => ({
    notifications: store.listNotifications()
  }));

  app.get('/backoffice/notifications', async (_request, reply) => {
    const notifications = store.listNotifications();
    const rows = notifications
      .map(
        (item) => `
          <tr>
            <td>${item.sentAt.toISOString()}</td>
            <td>${item.userId}</td>
            <td>${item.ruleId}</td>
            <td>${item.channel}</td>
            <td>${item.status}</td>
            <td>${item.error ?? ''}</td>
          </tr>
        `
      )
      .join('');

    return reply
      .type('text/html')
      .send(`<!doctype html>
        <html>
          <head>
            <title>Notification Monitor</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 24px; }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
              th { background: #f5f5f5; }
            </style>
          </head>
          <body>
            <h1>Telegram Notification Monitor</h1>
            <p>Total notifications: ${notifications.length}</p>
            <table>
              <thead>
                <tr>
                  <th>Sent At</th>
                  <th>User</th>
                  <th>Rule</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan=\"6\">No notifications yet.</td></tr>'}
              </tbody>
            </table>
          </body>
        </html>`);
  });

  app.get('/settings', async (_request, reply) => {
    const users = store.listUsers();
    const rules = store.listRules();
    const rows = rules
      .map(
        (rule) => `
          <tr>
            <td>${rule.userId}</td>
            <td>${rule.symbol}</td>
            <td>${rule.type}</td>
            <td>${rule.timeframe ?? '-'}</td>
            <td>${rule.isEnabled ? 'Enabled' : 'Disabled'}</td>
            <td>${rule.cooldownSec}s</td>
          </tr>
        `
      )
      .join('');

    const userRows = users
      .map(
        (user) => `
          <tr>
            <td>${user.id}</td>
            <td>${user.telegramChatId}</td>
            <td>${user.plan}</td>
          </tr>
        `
      )
      .join('');

    return reply
      .type('text/html')
      .send(`<!doctype html>
        <html>
          <head>
            <title>Notification Settings</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 24px; }
              table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
              th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
              th { background: #f5f5f5; }
            </style>
          </head>
          <body>
            <h1>Notification Settings</h1>
            <h2>Users</h2>
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Telegram Chat ID</th>
                  <th>Plan</th>
                </tr>
              </thead>
              <tbody>
                ${userRows || '<tr><td colspan=\"3\">No users yet.</td></tr>'}
              </tbody>
            </table>

            <h2>Alert Rules</h2>
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Symbol</th>
                  <th>Type</th>
                  <th>Timeframe</th>
                  <th>Status</th>
                  <th>Cooldown</th>
                </tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan=\"6\">No rules yet.</td></tr>'}
              </tbody>
            </table>
          </body>
        </html>`);
  });
};
