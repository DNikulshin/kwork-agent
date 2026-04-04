# ScanAgent

AI-агент для автоматического мониторинга фриланс-бирж. Парсит заказы, оценивает их нейросетью, генерирует два варианта персонализированного отклика и отправляет уведомление в Telegram. Все заказы синхронизируются в облако и доступны через PWA-дашборд.

---

## Содержание

- [Как это работает](#как-это-работает)
- [Стек технологий](#стек-технологий)
- [Быстрый старт](#быстрый-старт)
- [Переменные окружения](#переменные-окружения)
- [Запуск](#запуск)
- [GitHub Actions](#github-actions)
- [Telegram-команды](#telegram-команды)
- [Дашборд](#дашборд)
- [Структура проекта](#структура-проекта)
- [Добавить новую биржу](#добавить-новую-биржу)
- [Supabase: миграции](#supabase-миграции)

---

## Как это работает

```
Парсеры (Playwright)
  ↓
  Kwork · FL.ru · Freelance.ru · Habr Freelance
  ↓
Быстрый фильтр (без AI)
  — стоп-слова (реферат, диплом, перевод...)
  — мин. бюджет (по умолчанию 1 000 ₽)
  — макс. кол-во предложений (по умолчанию 10)
  ↓
AI-скоринг (DeepSeek, 0–10)
  ↓ только score ≥ minScore (по умолчанию 7)
Генерация 2 вариантов отклика параллельно
  — Вариант 1: сфокусированный (температура 0.5)
  — Вариант 2: креативный (температура 0.9)
  ↓
Уведомление в Telegram
  [✅ Вариант 1] [✅ Вариант 2] [⏭ Пропустить]
  ↓
Синхронизация в Supabase → PWA-дашборд
```

Агент запускается по расписанию раз в 30 минут через GitHub Actions и не требует собственного сервера.

---

## Стек технологий

| Слой | Технология |
|------|-----------|
| Язык | TypeScript (Node.js 20) |
| Парсинг | Playwright + puppeteer-extra-stealth |
| AI | OpenRouter API (модель: DeepSeek) |
| Локальная БД | SQLite (better-sqlite3, WAL-режим) |
| Облачная БД | Supabase (PostgreSQL) |
| Уведомления | Telegram Bot API, Web Push |
| Дашборд | Next.js 16 + React 19 + Tailwind CSS 4 |
| CI/CD | GitHub Actions (cron каждые 30 мин) |
| Логирование | Pino (JSON) |
| Валидация | Zod |

---

## Быстрый старт

### 1. Клонируйте репозиторий

```bash
git clone https://github.com/DNikulshin/scan-agent.git
cd scan-agent
```

### 2. Установите зависимости

```bash
# Бэкенд (агент)
npm install

# Дашборд
cd dashboard && npm install && cd ..
```

### 3. Установите браузер для Playwright

```bash
npx playwright install chromium --with-deps
```

### 4. Создайте `.env`

```bash
cp .env.example .env
# Заполните значения (см. раздел ниже)
```

### 5. Настройте Supabase

Выполните SQL из `supabase/migration.sql` в **Supabase → SQL Editor**.

### 6. Запустите агента

```bash
npm run dev
```

---

## Переменные окружения

### Бэкенд (`.env`)

```env
# OpenRouter — AI скоринг и генерация откликов
OPENROUTER_API_KEY=sk-or-...

# Telegram — бот для уведомлений
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=123456789

# Supabase — облачная БД и дашборд
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...

# Web Push уведомления (VAPID ключи)
VAPID_PUBLIC_KEY=BM...
VAPID_PRIVATE_KEY=k...

# Биржи — URL поиска (необязательно, есть дефолты)
KWORK_SEARCH_URL=https://kwork.ru/projects

FL_ENABLED=true
FL_SEARCH_URL=https://www.fl.ru/projects/

FREELANCERU_ENABLED=true
FREELANCERU_SEARCH_URL=https://freelance.ru/project/search/pro/razrabotka-sajtov/

HABR_ENABLED=true
HABR_SEARCH_URL=https://freelance.habr.com/tasks?categories=develop_programming,develop_javascript,develop_python,develop_mobile&type=all

# Путь к SQLite БД (необязательно)
DB_PATH=./agent.db

# Не останавливать процесс после цикла (для локального запуска)
KEEP_ALIVE=true
```

### Дашборд (`dashboard/.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Генерация VAPID-ключей

```bash
npx web-push generate-vapid-keys
```

---

## Запуск

### Режим разработки (с читаемыми логами)

```bash
npm run dev
```

### Продакшн

```bash
npm run build
npm start
```

### Дашборд

```bash
cd dashboard
npm run dev      # разработка → http://localhost:3000
npm run build    # сборка для деплоя (Vercel)
```

---

## GitHub Actions

Агент запускается автоматически каждые 30 минут через `.github/workflows/scan-agent.yml`.

### Настройка

В репозитории на GitHub: **Settings → Secrets and variables → Actions** добавьте все переменные из `.env` как secrets.

### Ручной запуск

**Actions → ScanAgent → Run workflow**

### Как работает кэш БД

SQLite-база (`agent.db`) кэшируется между запусками через `actions/cache`. Это позволяет не отправлять повторно уже обработанные заказы. Кэш восстанавливается по ключу `agent-db-` и сохраняется с ключом `agent-db-{run_id}` после каждого запуска.

---

## Telegram-команды

Команды работают в течение ~30 секунд после запуска агента (пока активен polling).

### Просмотр

| Команда | Описание |
|---------|----------|
| `/stats` | Статистика за сегодня и неделю (просканировано / отправлено / пропущено / средний балл) |
| `/settings` | Текущие настройки агента |
| `/setstop list` | Список активных стоп-слов |

### Настройка фильтров

| Команда | Описание | Пример |
|---------|----------|--------|
| `/setrate <сумма>` | Мин. бюджет заказа в рублях | `/setrate 3000` |
| `/setscore <0–10>` | Мин. балл для отправки в Telegram | `/setscore 8` |
| `/setstop add <слово>` | Добавить стоп-слово | `/setstop add дизайн` |
| `/setstop remove <слово>` | Удалить стоп-слово | `/setstop remove дизайн` |

Настройки сохраняются в SQLite и применяются с первого же запуска.

### Инлайн-кнопки на заказах

| Кнопка | Действие |
|--------|----------|
| `✅ Вариант 1` | Сохранить первый вариант отклика как основной |
| `✅ Вариант 2` | Сохранить второй вариант отклика, обновить Supabase |
| `⏭ Пропустить` | Добавить заказ в blacklist (не показывать повторно) |

---

## Дашборд

PWA-дашборд доступен по адресу деплоя на Vercel (или `localhost:3000` локально).

### Фильтры

- **Статус:** Все / Новые / Откликнулся / Пропущены
- **Источник:** Все / Kwork / FL.ru / Freelance.ru / Habr
- **Мин. балл:** Любой / ≥5 / ≥6 / ≥7 / ≥8 / ≥9
- **Теги технологий:** React, Node.js, Python, PHP, 1C, Telegram, Mobile, AI/ML, Парсинг, TypeScript и др.

### Карточка заказа

- Заголовок (ссылка на биржу), бюджет, кол-во откликов, дата, балл
- Теги технологий (определяются автоматически по ключевым словам)
- Причина AI-оценки
- Два варианта отклика (раскрывается по кнопке, тап → копировать)
- Кнопки: **✅ Откликнулся** / **⏭ Пропустить** / **↩ Сбросить**

### История откликов

В секции «Откликнулся» для каждого заказа можно отметить результат:
- **🏆 Выиграл** — получил заказ
- **❌ Проиграл** — не выбрали

В шапке дашборда отображается **win rate** по всем откликам.

### Напоминания

Заказы с баллом ≥ minScore, которые не были рассмотрены более 2 часов, автоматически получают повторное уведомление в Telegram при следующем запуске агента.

---

## Структура проекта

```
scan-agent/
├── src/                          # Бэкенд (Node.js агент)
│   ├── index.ts                  # Точка входа, оркестрация пайплайна
│   ├── config.ts                 # Все настройки и env-переменные
│   ├── types.ts                  # Общие TypeScript-интерфейсы
│   ├── profile.ts                # Профиль разработчика для AI-контекста
│   ├── core/
│   │   ├── analyzer.ts           # AI-скоринг + генерация двух вариантов отклика
│   │   ├── filter.ts             # Быстрый фильтр без AI (стоп-слова, цена, конкуренция)
│   │   ├── tagger.ts             # Автоматические теги по ключевым словам
│   │   └── storage.ts            # SQLite: история, blacklist, настройки, статистика
│   ├── parsers/
│   │   ├── browser.ts            # Playwright: фабрика браузера, утилиты
│   │   ├── kwork.ts              # Парсер kwork.ru
│   │   ├── fl.ts                 # Парсер fl.ru
│   │   ├── freelanceru.ts        # Парсер freelance.ru
│   │   └── habr.ts              # Парсер freelance.habr.com
│   ├── notifiers/
│   │   ├── telegram.ts           # Telegram Bot: уведомления, команды, callback-кнопки
│   │   ├── supabase.ts           # Supabase: синхронизация заказов в облако
│   │   └── push.ts               # Web Push уведомления
│   └── utils/
│       ├── logger.ts             # Pino JSON-логгер
│       └── retry.ts              # Экспоненциальный backoff для API-вызовов
├── dashboard/                    # Фронтенд (Next.js PWA)
│   ├── app/
│   │   ├── page.tsx              # Главная страница: список заказов, фильтры, статистика
│   │   ├── layout.tsx            # Root layout + PWA метаданные
│   │   ├── manifest.ts           # Web App Manifest
│   │   └── offline/page.tsx      # Страница для офлайн-режима
│   ├── components/
│   │   ├── OrderCard.tsx         # Карточка заказа с тегами, откликом, кнопками результата
│   │   ├── PushNotificationManager.tsx
│   │   └── ClientProviders.tsx
│   └── lib/
│       └── supabase.ts           # Supabase клиент + типы
├── supabase/
│   └── migration.sql             # SQL-схема (выполнить в Supabase SQL Editor)
├── .github/
│   └── workflows/
│       └── scan-agent.yml        # GitHub Actions: cron каждые 30 мин
└── scripts/
    └── test-push.ts              # Тест Web Push уведомлений
```

---

## Добавить новую биржу

1. **Создайте парсер** `src/parsers/mybourse.ts`:

```typescript
import { config } from '../config';
import { createBrowser, debugScreenshot } from './browser';
import type { Order, Parser } from '../types';

export class MyBourseParser implements Parser {
  name = 'mybourse';

  async fetchOrders(): Promise<Order[]> {
    if (!config.mybourse.enabled) return [];

    const { context, close } = await createBrowser();
    const page = await context.newPage();

    try {
      await page.goto(config.mybourse.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForSelector('.task-card', { timeout: 15_000 });

      return await page.$$eval('.task-card', cards => cards.map(card => {
        const linkEl = card.querySelector('a') as HTMLAnchorElement | null;
        const link = linkEl?.href ?? '';
        const id = link.match(/\/tasks\/(\d+)/)?.[1] ?? '';
        return {
          id,
          title: card.querySelector('h2')?.textContent?.trim() ?? '',
          desc:  card.querySelector('.desc')?.textContent?.trim() ?? '',
          price: card.querySelector('.price')?.textContent?.trim() ?? '',
          link,
          offersCount: 0,
          source: 'mybourse' as const,
        };
      }).filter(o => o.id !== ''));
    } catch (err) {
      await debugScreenshot(page, 'mybourse-error');
      return [];
    } finally {
      await close();
    }
  }
}
```

2. **Добавьте конфиг** в `src/config.ts`:

```typescript
mybourse: {
  enabled: process.env.MYBOURSE_ENABLED === 'true',
  url: process.env.MYBOURSE_URL ?? 'https://mybourse.ru/tasks',
},
```

3. **Расширьте тип источника** в `src/types.ts`:

```typescript
source: 'kwork' | 'fl' | 'freelanceru' | 'habr' | 'mybourse';
```

4. **Экспортируйте и подключите** в `src/parsers/index.ts` и `src/index.ts`.

5. **Добавьте метку** в `src/notifiers/telegram.ts` (`SOURCE_LABEL`) и эмодзи в `dashboard/components/OrderCard.tsx` (`SOURCE_EMOJI`).

6. **Добавьте опцию** в фильтр дашборда `dashboard/app/page.tsx`.

7. **Добавьте секрет** `MYBOURSE_ENABLED=true` в GitHub Actions.

---

## Supabase: миграции

Все миграции находятся в `supabase/migration.sql`. При обновлении проекта выполните новые `ALTER TABLE` команды в **Supabase → SQL Editor**:

```sql
-- Теги технологий
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '';

-- История откликов
ALTER TABLE orders ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS outcome TEXT DEFAULT 'pending';
```

---

## Профиль разработчика

Отредактируйте `src/profile.ts` — AI использует этот контекст для генерации персонализированных откликов. Укажите:

- Стек технологий и экспертизу
- Примеры реализованных проектов
- Преимущества и специализацию

Чем конкретнее профиль — тем точнее и убедительнее отклики.
