import { logger } from './logger';

interface RetryOptions {
  /** Максимум попыток (включая первую) */
  maxAttempts?: number;
  /** Начальная задержка в мс */
  baseDelay?: number;
  /** Множитель задержки */
  multiplier?: number;
  /** Максимальная задержка в мс */
  maxDelay?: number;
  /** Название операции для логов */
  label?: string;
  /** Функция для проверки, стоит ли retry */
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Выполняет функцию с экспоненциальным backoff при ошибках.
 *
 * Пример:
 *   const data = await withRetry(() => fetchFromAPI(), {
 *     maxAttempts: 3,
 *     label: 'OpenRouter',
 *   });
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    multiplier = 2,
    maxDelay = 30_000,
    label = 'operation',
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error)) {
        break;
      }

      const delay = Math.min(baseDelay * Math.pow(multiplier, attempt - 1), maxDelay);
      const jitter = delay * (0.5 + Math.random() * 0.5); // 50-100% of delay

      logger.warn(
        { attempt, maxAttempts, delay: Math.round(jitter), label },
        `${label}: попытка ${attempt}/${maxAttempts} не удалась, retry через ${Math.round(jitter)}мс`,
      );

      await new Promise(resolve => setTimeout(resolve, jitter));
    }
  }

  throw lastError;
}

/**
 * Проверяет, стоит ли повторять HTTP-запрос по коду ответа.
 * 429 (rate limit), 5xx (сервер), таймауты — retry.
 * 4xx (кроме 429) — не retry, клиентская ошибка.
 */
export function isRetryableHttpError(error: unknown): boolean {
  const err = error as { response?: { status?: number }; code?: string };

  // Таймаут или проблемы с сетью
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
    return true;
  }

  const status = err.response?.status;
  if (!status) return true; // нет статуса = возможно сетевая ошибка

  return status === 429 || status >= 500;
}
