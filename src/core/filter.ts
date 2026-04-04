import { config } from '../config';
import type { DynamicSettings } from './storage';
import type { Order } from '../types';

/**
 * Быстрый фильтр без AI — отсекает очевидный мусор.
 * Возвращает причину отказа или null если заказ прошёл.
 */
export function getTrashReason(order: Order, settings?: DynamicSettings): string | null {
  const stopWords = settings?.stopWords ?? config.filter.stopWords;
  const minPrice  = settings?.minPrice  ?? config.filter.minPrice;
  const maxOffers = settings?.maxOffers ?? config.filter.maxOffers;

  const content = `${order.title} ${order.desc}`.toLowerCase();

  const matched = stopWords.find(w => content.includes(w));
  if (matched) return `стоп-слово: "${matched}"`;

  const price = parseInt(order.price.replace(/\D/g, ''), 10);
  if (!isNaN(price) && price < minPrice) {
    return `цена ${price}₽ < ${minPrice}₽`;
  }

  if (order.offersCount > maxOffers) {
    return `${order.offersCount} предложений > ${maxOffers}`;
  }

  return null;
}
