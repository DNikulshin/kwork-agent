import Database from 'better-sqlite3';
import path from 'path';

import { logger } from '../utils/logger';

/**
 * SQLite-хранилище для обработанных заказов.
 *
 * Преимущества перед JSON-кэшем:
 * - Атомарные записи, нет гонки данных
 * - Blacklist для заказов (кнопка "Пропустить" в Telegram)
 * - История с оценками — база для будущего веб-интерфейса
 * - Быстрый поиск по ID
 */
export class Storage {
  private db: Database.Database;

  constructor() {
    const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), 'agent.db');
    this.db = new Database(dbPath);

    // WAL-mode для лучшей производительности при конкурентном доступе
    this.db.pragma('journal_mode = WAL');

    this.migrate();
    logger.info({ dbPath }, 'SQLite хранилище инициализировано');
  }

  /** Проверяет, был ли заказ уже обработан */
  isProcessed(orderId: string, source: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM orders WHERE order_id = ? AND source = ?')
      .get(orderId, source);
    return !!row;
  }

  /** Проверяет, в чёрном ли списке заказ */
  isBlacklisted(orderId: string, source: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM orders WHERE order_id = ? AND source = ? AND blacklisted = 1')
      .get(orderId, source);
    return !!row;
  }

  /** Сохраняет обработанный заказ */
  markProcessed(params: {
    orderId: string;
    source: string;
    title: string;
    score: number;
    link: string;
    pitch?: string;
  }): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO orders (order_id, source, title, score, link, pitch, processed_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .run(params.orderId, params.source, params.title, params.score, params.link, params.pitch ?? '');
  }

  /** Возвращает сохранённый питч для заказа */
  getPitch(orderId: string, source: string): string {
    const row = this.db
      .prepare('SELECT pitch FROM orders WHERE order_id = ? AND source = ?')
      .get(orderId, source) as { pitch: string } | undefined;
    return row?.pitch ?? '';
  }

  /** Добавляет заказ в чёрный список (кнопка "Пропустить" в Telegram) */
  blacklist(orderId: string, source: string): void {
    const result = this.db
      .prepare(
        `UPDATE orders SET blacklisted = 1 WHERE order_id = ? AND source = ?`,
      )
      .run(orderId, source);

    // Если заказа ещё нет — создаём запись сразу с blacklist
    if (result.changes === 0) {
      this.db
        .prepare(
          `INSERT INTO orders (order_id, source, blacklisted, processed_at)
           VALUES (?, ?, 1, datetime('now'))`,
        )
        .run(orderId, source);
    }

    logger.info({ orderId, source }, 'Заказ добавлен в blacklist');
  }

  /** Количество обработанных заказов */
  get count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number };
    return row.cnt;
  }

  /** Очистка старых записей (старше N дней) */
  cleanup(daysOld: number = 30): number {
    const result = this.db
      .prepare(`DELETE FROM orders WHERE processed_at < datetime('now', ?)`)
      .run(`-${daysOld} days`);
    if (result.changes > 0) {
      logger.info({ deleted: result.changes, daysOld }, 'Очищены старые записи');
    }
    return result.changes;
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        order_id    TEXT NOT NULL,
        source      TEXT NOT NULL DEFAULT '',
        title       TEXT DEFAULT '',
        score       INTEGER DEFAULT 0,
        link        TEXT DEFAULT '',
        pitch       TEXT DEFAULT '',
        blacklisted INTEGER DEFAULT 0,
        processed_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (order_id, source)
      );
      CREATE INDEX IF NOT EXISTS idx_orders_processed ON orders(processed_at);
    `);
    // Миграция для существующих БД без колонки pitch
    try {
      this.db.exec(`ALTER TABLE orders ADD COLUMN pitch TEXT DEFAULT ''`);
    } catch {
      // Колонка уже есть — игнорируем
    }
  }
}
