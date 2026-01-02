import type { TriggeredAlert } from '../types/domain.js';
import { config } from '../config.js';

export class TelegramDispatcher {
  async dispatch(alert: TriggeredAlert): Promise<void> {
    if (!config.telegramBotToken) {
      throw new Error('Missing TELEGRAM_BOT_TOKEN');
    }

    const message = this.buildMessage(alert);
    const body = {
      chat_id: alert.user.telegramChatId,
      text: message,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'View on CryptoBriefs',
              url: config.telegramDefaultLink
            }
          ]
        ]
      }
    };

    const response = await fetch(
      `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Telegram send failed: ${response.status} ${text}`);
    }
  }

  private buildMessage(alert: TriggeredAlert): string {
    const payload = alert.payload as Record<string, unknown>;
    return [
      `*${alert.rule.type.replace('_', ' ')} Alert*`,
      `Symbol: ${alert.rule.symbol}`,
      payload.timeframe ? `Timeframe: ${payload.timeframe}` : null,
      payload.change ? `Change: ${Number(payload.change).toFixed(2)}%` : null,
      payload.price
        ? `Price: ${Number(payload.price).toFixed(4)}`
        : payload.close
          ? `Close: ${Number(payload.close).toFixed(4)}`
          : null,
      payload.volume ? `Volume: ${payload.volume}` : null
    ]
      .filter(Boolean)
      .join('\n');
  }
}
