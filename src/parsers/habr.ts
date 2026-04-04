import { config } from '../config';
import { createBrowser, debugScreenshot } from './browser';
import type { Order, Parser } from '../types';

/**
 * Парсер Habr Freelance — IT-ориентированная биржа, качественная аудитория.
 * Сайт серверного рендеринга, поэтому работает надёжнее FL.ru.
 * URL: https://freelance.habr.com/tasks
 */
export class HabrParser implements Parser {
  name = 'habr';

  async fetchOrders(): Promise<Order[]> {
    if (!config.habr.enabled) {
      console.log('⏭️  [habr] Парсер отключён (HABR_ENABLED != true)');
      return [];
    }

    const { context, close } = await createBrowser();
    const page = await context.newPage();

    try {
      console.log(`🌐 [habr] Открываю ${config.habr.url}`);
      await page.goto(config.habr.url, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });

      await page.waitForSelector(config.habr.selectors.card, { timeout: 15_000 });

      const raw = await page.$$eval(
        config.habr.selectors.card,
        (cards) => {
          return cards.map(card => {
            // Ссылка и заголовок
            const linkEl = card.querySelector('.task__title a, h2 a, h3 a') as HTMLAnchorElement | null;
            const link = linkEl?.href ?? '';
            const title = linkEl?.textContent?.trim() ?? '';

            // ID из URL /tasks/XXXXXX
            const idMatch = link.match(/\/tasks\/(\d+)/);
            const id = idMatch?.[1] ?? '';

            // Описание
            const descEl = card.querySelector('.task__description, .preview__text, [class*="description"]');
            const desc = descEl?.textContent?.trim() ?? '';

            // Цена
            const priceEl = card.querySelector('.task__price, .price-box__money, [class*="price"]');
            const price = priceEl?.textContent?.trim() ?? 'Договорная';

            // Количество откликов
            const responsesEl = card.querySelector('.count-responses, .task__responses-count, [class*="responses"]');
            const responsesText = responsesEl?.textContent?.trim() ?? '';
            const responsesMatch = responsesText.match(/\d+/);
            const offersCount = responsesMatch ? parseInt(responsesMatch[0], 10) : 0;

            return { id, title, desc, price, link, offersCount, source: 'habr' as const };
          }).filter(o => o.id !== '' && o.title !== '');
        },
      );

      if (raw.length === 0) {
        await debugScreenshot(page, 'habr-empty');
        console.warn('⚠️  [habr] 0 заказов — возможно изменилась вёрстка');
      } else {
        console.log(`📋 [habr] Найдено: ${raw.length}`);
      }

      return raw;
    } catch (err) {
      await debugScreenshot(page, 'habr-error');
      console.error('❌ [habr] Ошибка:', (err as Error).message);
      return [];
    } finally {
      await close();
    }
  }
}
