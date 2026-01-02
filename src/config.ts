const readNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const config = {
  port: readNumber(process.env.PORT, 3000),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  telegramDefaultLink: process.env.TELEGRAM_DEFAULT_LINK ?? 'https://cryptobriefs.net',
  maxRulesFree: readNumber(process.env.MAX_RULES_FREE, 3),
  maxRulesPro: readNumber(process.env.MAX_RULES_PRO, 20),
  logLevel: process.env.LOG_LEVEL ?? 'info'
};
