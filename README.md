# Crypto Smart Alert Service (TypeScript) — Spec v0.1

Goal: build a standalone **alert engine service** (TypeScript) for crypto price/volume alerts, with **Telegram delivery** first. Designed to be integrated later into **cryptobriefs.net**.

---

## 0) Non-goals (for MVP)
- No futures positions, no auto-trading, no signal “guaranteed profit”
- No email/WA push (Telegram only)
- No complicated indicators (RSI/MACD) for v0.1
- No multi-exchange (Binance only)

---

## 1) MVP Scope

### 1.1 Alert Types (MVP = 3)
1) **Extreme Move**
- Trigger when price changes by `±X%` within `Y minutes`.

2) **Breakout**
- Trigger when last price crosses above/below a **rolling N-candle high/low** on a given timeframe.

3) **Volume Spike**
- Trigger when volume of current candle exceeds `K × avgVolume(N)` on a timeframe.

### 1.2 Delivery Channel
- **Telegram Bot** (send message to user chat_id)
- Support plain text + optional inline button link to cryptobriefs.net

### 1.3 User Controls
- Choose symbol (e.g., BTCUSDT)
- Choose timeframe (1m, 5m, 15m) for breakout/volume
- Cooldown / rate limit per rule (anti-spam)
- Enable/disable rule
- Max active rules per plan (Free vs Pro) via config, not payment integration yet

---

## 2) System Overview

### 2.1 High-level Flow
1. Market data ingestion (Binance WebSocket + optional REST fallback)
2. Candle aggregation (if needed) or direct kline stream
3. Rule evaluation
4. Dedup + cooldown checks
5. Dispatch alert to Telegram
6. Persist alert event

### 2.2 Services / Modules
- `MarketData` (Binance WS/Kline streams)
- `CandleStore` (in-memory + Redis cache; optional DB persistence)
- `RuleEngine` (evaluates rules)
- `Dispatcher` (Telegram)
- `Persistence` (Postgres for users/rules/alerts)
- `API` (REST for CRUD rules + health)

---

## 3) Tech Stack (recommended)
- Runtime: Node.js 20+
- Language: TypeScript
- Web framework: Fastify (or Express)
- DB: PostgreSQL
- Cache/Queue: Redis (for dedupe/cooldown + optional job queue)
- ORM: Prisma (or Drizzle)
- Logging: pino
- Testing: vitest
- Docker: docker-compose for local

---

## 4) Data Sources

### 4.1 Binance Streams
Prefer **kline** stream for candle-based rules:
- `wss://stream.binance.com:9443/ws/<symbol>@kline_<interval>`
Intervals needed: `1m`, `5m`, `15m`

For Extreme Move (price change in Y minutes), can use:
- trade stream, miniTicker, or 1m klines

### 4.2 Fallback
- REST endpoint to fetch last N klines if WS reconnect happens:
  - `/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=500`

---

## 5) Domain Model

### 5.1 Entities

#### User
- `id: uuid`
- `email: string` (optional for MVP)
- `telegramChatId: string` (required for Telegram delivery)
- `plan: 'FREE' | 'PRO'`
- `createdAt, updatedAt`

#### AlertRule
- `id: uuid`
- `userId: uuid`
- `symbol: string` (e.g., BTCUSDT)
- `type: 'EXTREME_MOVE' | 'BREAKOUT' | 'VOLUME_SPIKE'`
- `timeframe: '1m' | '5m' | '15m' | null` (null for some rules)
- `params: jsonb` (see below)
- `isEnabled: boolean`
- `cooldownSec: number` (default e.g., 900)
- `createdAt, updatedAt`

#### AlertEvent
- `id: uuid`
- `ruleId: uuid`
- `userId: uuid`
- `symbol: string`
- `type: string`
- `triggeredAt: timestamp`
- `payload: jsonb` (snapshot details: price, change, candle, etc.)

---

## 6) Rule Params (JSON schema-ish)

### 6.1 EXTREME_MOVE params
```json
{
  "windowMin": 15,
  "percent": 2.0,
  "direction": "UP" | "DOWN" | "BOTH"
}
