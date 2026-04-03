import { config } from '../config';
import type { Order } from '../types';

/**
 * Быстрый фильтр без AI — отсекает очевидный мусор.
 * Возвращает причину отказа или null если заказ прошёл.
 */
export function getTrashReason(order: Order): string | null {
  const content = `${order.title} ${order.desc}`.toLowerCase();

  const matched = config.filter.stopWords.find(w => content.includes(w));
  if (matched) return `стоп-слово: "${matched}"`;

  const price = parseInt(order.price.replace(/\D/g, ''), 10);
  if (!isNaN(price) && price < config.filter.minPrice) {
    return `цена ${price}₽ < ${config.filter.minPrice}₽`;
  }

  if (order.offersCount > config.filter.maxOffers) {
    return `${order.offersCount} предложений > ${config.filter.maxOffers}`;
  }

  return null;
}
