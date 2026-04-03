import pino from 'pino';

/**
 * Структурированный логгер на базе pino.
 *
 * Логи в формате JSON — удобно для grep, мониторинга, tail -f.
 * В dev-режиме можно включить pretty-print через PRETTY_LOGS=true.
 *
 * Примеры использования:
 *   logger.info({ orderId: '123', score: 8 }, 'Заказ прошёл скоринг');
 *   logger.warn({ parser: 'kwork' }, 'Селектор не найден');
 *   logger.error({ err, url }, 'Парсинг провален');
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.PRETTY_LOGS === 'true'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
