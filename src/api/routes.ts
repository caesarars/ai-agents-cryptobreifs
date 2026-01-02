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
            <p><a href="/settings/manage">Manage settings</a></p>
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

  app.get('/settings/manage', async (_request, reply) => {
    return reply
      .type('text/html')
      .send(`<!doctype html>
        <html>
          <head>
            <title>Manage Notification Settings</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 24px; }
              form { border: 1px solid #ddd; padding: 16px; margin-bottom: 24px; }
              label { display: block; margin: 8px 0 4px; }
              input, select, textarea { width: 100%; padding: 8px; }
              button { margin-top: 12px; padding: 8px 16px; }
              .row { display: flex; gap: 16px; }
              .row > div { flex: 1; }
            </style>
          </head>
          <body>
            <h1>Manage Notification Settings</h1>
            <p><a href="/settings">Back to overview</a></p>

            <form method="post" action="/settings/users">
              <h2>Create User</h2>
              <label for="telegramChatId">Telegram Chat ID</label>
              <input id="telegramChatId" name="telegramChatId" required />

              <label for="email">Email (optional)</label>
              <input id="email" name="email" />

              <label for="plan">Plan</label>
              <select id="plan" name="plan">
                <option value="FREE">FREE</option>
                <option value="PRO">PRO</option>
              </select>
              <button type="submit">Create User</button>
            </form>

            <form method="post" action="/settings/rules">
              <h2>Create Alert Rule</h2>
              <label for="userId">User ID</label>
              <input id="userId" name="userId" required />

              <div class="row">
                <div>
                  <label for="symbol">Symbol</label>
                  <input id="symbol" name="symbol" required placeholder="BTCUSDT" />
                </div>
                <div>
                  <label for="type">Type</label>
                  <select id="type" name="type">
                    <option value="EXTREME_MOVE">EXTREME_MOVE</option>
                    <option value="BREAKOUT">BREAKOUT</option>
                    <option value="VOLUME_SPIKE">VOLUME_SPIKE</option>
                  </select>
                </div>
              </div>

              <label for="timeframe">Timeframe (required for BREAKOUT/VOLUME_SPIKE)</label>
              <select id="timeframe" name="timeframe">
                <option value="">None</option>
                <option value="1m">1m</option>
                <option value="5m">5m</option>
                <option value="15m">15m</option>
              </select>

              <label for="params">Params (JSON)</label>
              <textarea id="params" name="params" rows="6" placeholder='{\"windowMin\":15,\"percent\":2,\"direction\":\"BOTH\"}'></textarea>

              <div class="row">
                <div>
                  <label for="cooldownSec">Cooldown (seconds)</label>
                  <input id="cooldownSec" name="cooldownSec" type="number" value="900" />
                </div>
                <div>
                  <label for="isEnabled">Enabled</label>
                  <select id="isEnabled" name="isEnabled">
                    <option value="true" selected>Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
              </div>

              <button type="submit">Create Rule</button>
            </form>
          </body>
        </html>`);
  });

  app.post('/settings/users', async (request, reply) => {
    const body = request.body as Record<string, string | undefined>;
    const telegramChatId = body.telegramChatId?.trim();
    if (!telegramChatId) {
      return reply.status(400).send('Telegram Chat ID is required');
    }

    store.createUser({
      telegramChatId,
      email: body.email?.trim() || undefined,
      plan: body.plan === 'PRO' ? 'PRO' : 'FREE'
    });

    return reply.redirect('/settings');
  });

  app.post('/settings/rules', async (request, reply) => {
    const body = request.body as Record<string, string | undefined>;
    const userId = body.userId?.trim();
    const symbol = body.symbol?.trim();
    const type = body.type?.trim() ?? '';
    const timeframe = body.timeframe?.trim() ?? '';

    if (!userId || !symbol || !type) {
      return reply.status(400).send('userId, symbol, and type are required');
    }

    if (!isAlertType(type)) {
      return reply.status(400).send('Invalid rule type');
    }

    if (timeframe && !isTimeframe(timeframe)) {
      return reply.status(400).send('Invalid timeframe');
    }

    const user = store.getUser(userId);
    if (!user) {
      return reply.status(404).send('User not found');
    }

    let params: AlertRule['params'];
    try {
      params = body.params ? (JSON.parse(body.params) as AlertRule['params']) : ({} as AlertRule['params']);
    } catch (error) {
      return reply.status(400).send('Params must be valid JSON');
    }

    store.createRule({
      userId,
      symbol,
      type,
      timeframe: timeframe ? timeframe : null,
      params,
      isEnabled: body.isEnabled !== 'false',
      cooldownSec: body.cooldownSec ? Number(body.cooldownSec) : 900
    });

    return reply.redirect('/settings');
  });
};
