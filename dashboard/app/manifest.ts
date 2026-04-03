import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ScanAgent',
    short_name: 'ScanAgent',
    description: 'Мониторинг заказов с фриланс-бирж',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#030712',
    theme_color: '#030712',
    // Иконки временно убраны — добавьте PNG в public/icons/
    icons: [],
  };
}
