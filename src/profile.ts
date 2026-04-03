// ── Твой профиль ──
// Заполни реальными данными — это то, что отличает твой отклик от сотни шаблонных.
// AI будет использовать эту информацию для генерации персонализированных pitch.

export const profile = {
  name: 'Дмитрий',

  /** Главная специализация — одно предложение */
  headline: 'Fullstack-разработчик: Next.js, TypeScript, AI-интеграции',

  /** Стек технологий (перечисли только то, в чём уверен) */
  stack: [
    'TypeScript', 'Next.js', 'React', 'Node.js',
    'PostgreSQL', 'Prisma', 'REST API', 'AI/LLM-агенты',
    'Playwright', 'Docker',
  ],

  /** 2-3 завершённых проекта с результатами (конкретика = доверие) */
  portfolio: [
    // TODO: Заполни реальными проектами
    {
      title: 'AI-агент для мониторинга фриланс-бирж',
      result: 'Автоматический поиск и оценка заказов, экономит 2 часа в день',
    },
    {
      title: 'Пример: SaaS-дашборд для аналитики',
      result: 'Next.js + PostgreSQL, 500+ пользователей',
    },
  ],

  /** Средние сроки — клиенту важно понимать тайминг */
  typicalTimeline: '3-14 дней в зависимости от сложности',

  /** Как ты общаешься (AI будет подстраивать тон pitch) */
  communicationStyle: 'Конкретно и по делу, без воды. Сразу к сути.',

  /** Преимущества, которые стоит упоминать */
  strengths: [
    'Пишу чистый, типизированный код на TypeScript',
    'Опыт работы с AI API (OpenAI, Anthropic, OpenRouter)',
    'Быстрая коммуникация, ежедневные апдейты',
  ],
};

/**
 * Формирует контекст профиля для промпта.
 * Вызывается в analyzer при генерации pitch.
 */
export function getProfileContext(): string {
  const projects = profile.portfolio
    .map(p => `  • ${p.title} → ${p.result}`)
    .join('\n');

  const strengths = profile.strengths
    .map(s => `  • ${s}`)
    .join('\n');

  return [
    `Имя: ${profile.name}`,
    `Специализация: ${profile.headline}`,
    `Стек: ${profile.stack.join(', ')}`,
    `\nПортфолио:`,
    projects,
    `\nСильные стороны:`,
    strengths,
    `\nСроки: ${profile.typicalTimeline}`,
    `Стиль: ${profile.communicationStyle}`,
  ].join('\n');
}
