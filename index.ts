require('dotenv').config();

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

import axios from 'axios';
import fs from 'fs';

const CACHE_FILE = 'processed_ids.json';
const STOP_WORDS = ['отзыв', 'реферат', 'диплом', 'курсовая', 'перевод', 'копирайт', 'текст'];
const MIN_PRICE = 1000;
const MAX_OFFERS = 10;

// --- Загрузка кэша обработанных ID ---
function loadCache(): string[] {
  try {
    return fs.existsSync(CACHE_FILE)
      ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
      : [];
  } catch {
    return [];
  }
}

function saveCache(ids: string[]): void {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(ids.slice(-200)));
}

// --- Фильтр мусора без AI (экономим токены) ---
function isTrash(title: string, desc: string, priceStr: string): boolean {
  const content = (title + ' ' + desc).toLowerCase();
  if (STOP_WORDS.some(w => content.includes(w))) return true;

  const price = parseInt(priceStr.replace(/\D/g, ''));
  if (!isNaN(price) && price < MIN_PRICE) return true;

  return false;
}

// --- Анализ заказа через OPENROUTER ---
const FREE_MODELS = [
  'openrouter/free',              // 🏆 авто-роутер — всегда актуален
  'nvidia/nemotron-3-super:free', // fallback #1 — Programming #4
  'stepfun/step-3.5-flash:free',  // fallback #2 — быстрый
];

async function analyzeOrder(title: string, desc: string, attempt = 1): Promise<{
  score: number;
  reason: string;
  pitch: string;
}> {
  const model = FREE_MODELS[(attempt - 1) % FREE_MODELS.length];

  const prompt = `Ты опытный Fullstack-разработчик (Next.js, TypeScript, AI-агенты).
Оцени заказ с биржи фриланса.

Заказ: ${title}
Описание: ${desc}

Если заказ — мусор (не ИТ, слишком дёшево, нет смысла браться), верни: {"score": 0, "reason": "причина", "pitch": ""}
Если заказ подходит, верни JSON:
{
  "score": число от 1 до 10,
  "reason": "почему стоит брать (1-2 предложения)",
  "pitch": "готовый отклик клиенту (3-4 предложения, без воды)"
}
Отвечай ТОЛЬКО JSON, без markdown.`;

  try {
    const res = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const raw = res.data.choices[0].message.content;
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean);
  } catch (e: any) {
    const code = e?.response?.data?.error?.code;

    if ((code === 429 || code === 404 || code === 400) && attempt < FREE_MODELS.length) {
      console.log(`⚠️  Ошибка модели ${model}, пробую следующую: ${FREE_MODELS[attempt]}...`);
      await new Promise(r => setTimeout(r, 2000));
      return analyzeOrder(title, desc, attempt + 1);
    }

    console.error('Ошибка OpenRouter:', e?.response?.data || e.message);
    return { score: 0, reason: 'ошибка анализа', pitch: '' };
  }
}

// --- Отправка в Telegram ---
async function sendTelegram(order: {
  title: string;
  price: string;
  link: string;
  offersCount: number;
}, ai: { score: number; reason: string; pitch: string }): Promise<void> {

  const msg =
    `🔥 *${order.title}*\n` +
    `💰 ${order.price} | 📨 Предложений: ${order.offersCount}\n` +
    `⭐ Оценка: ${ai.score}/10\n\n` +
    `🧠 *Почему брать:*\n${ai.reason}\n\n` +
    `📝 *Готовый отклик:*\n${ai.pitch}\n\n` +
    `🔗 ${order.link}`;

  await axios.post(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: msg,
      parse_mode: 'Markdown',
    },
    { timeout: 10000 }
  );
}

// --- Главная функция ---
async function run(): Promise<void> {
  console.log('🚀 Запуск агента...');
  const processedIds = loadCache();

  const browser = await chromium.launch({
    headless: true,
    // headless: false,  // раскомментируй чтобы видеть браузер при отладке
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'ru-RU',
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    console.log('🌐 Открываю Kwork...');
    await page.goto(process.env.KWORK_SEARCH_URL || 'https://kwork.ru/projects', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    await page.waitForSelector('.want-card', { timeout: 15000 });
    console.log('✅ Карточки появились в DOM');

    await page.screenshot({ path: 'debug.png' });
    console.log('📸 Скриншот сохранён: debug.png');

    const orders = await page.$$eval('.want-card', (cards: any[]) =>
      cards.map(c => {
        const link = (c.querySelector('a') as HTMLAnchorElement)?.href || '';
        const idMatch = link.match(/\/projects\/(\d+)/);

        // Парсим количество предложений
        const mr8els = c.querySelectorAll('.mr8');
        let offersCount = 999;
        mr8els.forEach((el: any) => {
          const t = el.textContent.trim();
          if (t.includes('Предложений')) {
            const match = t.match(/\d+/);
            if (match) offersCount = parseInt(match[0]);
          }
        });

        return {
          id: idMatch ? idMatch[1] : '',
          title: c.querySelector('.wants-card__header-title a')?.textContent?.trim() || '',
          desc: c.querySelector('.wants-card__description-text')?.textContent?.trim() || '',
          price: c.querySelector('.wants-card__price-wrap')?.textContent?.trim() || '',
          link,
          offersCount,
        };
      }).filter(o => o.id !== '')
    );

    // Фильтр по количеству предложений
    const filtered = orders.filter(o => o.offersCount <= MAX_OFFERS);
    console.log(`📋 Найдено заказов: ${orders.length}, после фильтра (≤${MAX_OFFERS} предложений): ${filtered.length}`);

    let newCount = 0;
    let sentCount = 0;

    for (const order of filtered) {
      if (!order.id || processedIds.includes(order.id)) continue;

      newCount++;

      if (isTrash(order.title, order.desc, order.price)) {
        console.log(`🗑️  Мусор: ${order.title}`);
        processedIds.push(order.id);
        continue;
      }

      console.log(`🔍 Анализирую [${order.offersCount} предл.]: ${order.title}`);
      const ai = await analyzeOrder(order.title, order.desc);

      if (ai.score >= 7) {
        await sendTelegram(order, ai);
        console.log(`✅ Отправлено в Telegram (score: ${ai.score}): ${order.title}`);
        sentCount++;
      } else {
        console.log(`⏭️  Пропущен (score: ${ai.score}): ${order.title}`);
      }

      processedIds.push(order.id);

      // Пауза чтобы не спамить OpenRouter
      await new Promise(r => setTimeout(r, 15000));
    }

    saveCache(processedIds);
    console.log(`\n📊 Итог: новых ${newCount}, отправлено ${sentCount}`);

  } catch (e) {
    console.error('❌ Ошибка:', e);
    await page.screenshot({ path: 'debug.png' });
    console.log('📸 Скриншот ошибки сохранён: debug.png');
  } finally {
    await browser.close();
  }
}

run();
