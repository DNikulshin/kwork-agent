import fs from 'fs';
import { config } from '../config';

/**
 * Простой JSON-кэш обработанных ID.
 * FIFO: хранит последние N записей, старые вытесняются.
 */
export class Cache {
  private ids: Set<string>;
  private ordered: string[]; // для FIFO-порядка

  constructor() {
    this.ordered = this.load();
    this.ids = new Set(this.ordered);
  }

  has(id: string): boolean {
    return this.ids.has(id);
  }

  add(id: string): void {
    if (this.ids.has(id)) return;

    this.ids.add(id);
    this.ordered.push(id);

    // FIFO: если превысили лимит — убираем самый старый
    if (this.ordered.length > config.cache.maxSize) {
      const removed = this.ordered.shift()!;
      this.ids.delete(removed);
    }
  }

  save(): void {
    try {
      fs.writeFileSync(config.cache.file, JSON.stringify(this.ordered, null, 2));
    } catch (err) {
      console.error('⚠️  Не удалось сохранить кэш:', (err as Error).message);
    }
  }

  get size(): number {
    return this.ids.size;
  }

  private load(): string[] {
    try {
      if (!fs.existsSync(config.cache.file)) return [];
      const raw = fs.readFileSync(config.cache.file, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((x): x is string => typeof x === 'string');
    } catch {
      return [];
    }
  }
}
