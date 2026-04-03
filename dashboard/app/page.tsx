'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { OrderCard } from '@/components/OrderCard';
import type { Order } from '@/lib/supabase';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type FilterStatus = 'all' | 'new' | 'applied' | 'skipped';
type FilterSource = 'all' | 'kwork' | 'fl' | 'freelanceru';

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<any[] | null>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const status = (searchParams.get('status') ?? 'all') as FilterStatus;
  const source = (searchParams.get('source') ?? 'all') as FilterSource;
  const minScore = parseInt(searchParams.get('minScore') ?? '0', 10);

  useEffect(() => {
    async function loadData() {
      try {
        let query = supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (status !== 'all') query = query.eq('status', status);
        if (source !== 'all') query = query.eq('source', source);
        if (minScore > 0) query = query.gte('score', minScore);

        const { data, error: err } = await query;
        setOrders(data);
        setError(err);
      } catch (err) {
        console.error('Error fetching orders:', err);
        setError({ message: 'Ошибка при загрузке данных' });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [status, source, minScore]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`?${params.toString()}`);
  };

  const counts = {
    new: 0, applied: 0, skipped: 0, all: 0,
  };
  if (orders) {
    orders.forEach(o => {
      counts.all++;
      const s = typeof o.status === 'string' && ['new', 'applied', 'skipped'].includes(o.status) ? o.status as FilterStatus : 'new';
      counts[s]++;
    });
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center text-gray-400">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">🔍 ScanAgent</h1>
        <p className="text-gray-400 text-sm">Заказы с фриланс-бирж · обновляется каждые 30 мин</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Status tabs */}
        <div className="flex gap-1 bg-gray-900 rounded-lg p-1 border border-gray-800">
          {(['all', 'new', 'applied', 'skipped'] as FilterStatus[]).map(s => (
            <FilterButton key={s} value={s} current={status} onClick={() => updateFilter('status', s)}
              label={{ all: 'Все', new: 'Новые', applied: 'Откликнулся', skipped: 'Пропущены' }[s]}
            />
          ))}
        </div>

        {/* Source */}
        <div className="flex gap-1 bg-gray-900 rounded-lg p-1 border border-gray-800">
          {(['all', 'kwork', 'fl', 'freelanceru'] as FilterSource[]).map(s => (
            <FilterButton key={s} value={s} current={source} onClick={() => updateFilter('source', s)}
              label={{ all: 'Все биржи', kwork: 'Kwork', fl: 'FL.ru', freelanceru: 'Freelance.ru' }[s]}
            />
          ))}
        </div>

        {/* Min score */}
        <div className="flex gap-1 bg-gray-900 rounded-lg p-1 border border-gray-800">
          {[0, 7, 8, 9].map(s => (
            <FilterButton key={s} value={String(s)} current={String(minScore)} onClick={() => updateFilter('minScore', String(s))}
              label={s === 0 ? 'Все оценки' : `≥${s}⭐`}
            />
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-800 p-4 text-red-400 mb-6 text-sm">
          Ошибка загрузки: {typeof error.message === 'string' ? error.message : 'Неизвестная ошибка'}
        </div>
      )}

      {/* Stats */}
      <div className="flex gap-4 text-sm text-gray-500 mb-4">
        <span>Показано: <b className="text-white">{orders?.length ?? 0}</b></span>
        <span>Новых: <b className="text-blue-400">{counts.new}</b></span>
        <span>Откликнулся: <b className="text-green-400">{counts.applied}</b></span>
      </div>

      {/* Orders */}
      <div className="flex flex-col gap-4">
        {orders?.length === 0 && (
          <p className="text-gray-500 text-center py-16">Заказов не найдено</p>
        )}
        {orders?.map(order => (
          <OrderCard key={typeof order.id === 'string' ? order.id : Math.random()} order={order as Order} />
        ))}
      </div>
    </div>
  );
}

function FilterButton({
  value, current, onClick, label,
}: {
  value: string; current: string; onClick: () => void; label: string;
}) {
  const isActive = value === current;
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      {label}
    </button>
  );
}
