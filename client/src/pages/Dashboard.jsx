import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, CartesianGrid } from 'recharts';

const monthOptions = [
  { label: 'All Time', value: 'all' },
  ...Array.from({ length: 12 }, (_, i) => ({ label: new Date(0, i).toLocaleString('en', { month: 'long' }), value: String(i+1).padStart(2, '0') }))
];

export default function Dashboard() {
  const [period, setPeriod] = useState('all');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cards, setCards] = useState([]);

  const fetchSummary = async () => {
    setLoading(true); setError('');
    try {
      const year = new Date().getFullYear();
      const params = period === 'all' ? { period } : { period: `${year}-${period}` };
      const { data } = await api.get('/stats/summary', { params });
      setSummary(data);
    } catch (err) { setError(err.response?.data?.message || 'Failed to load summary'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSummary(); }, [period]);

  // Cargar tarjetas para uso en Credit Card Usage
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/cards');
        setCards(data || []);
      } catch {
        // omitimos el error aquí para no bloquear el dashboard
      }
    })();
  }, []);

  // Datos mensuales para el gráfico de Ingresos vs Gastos (últimos 6 meses)
  const barData = useMemo(() => {
    if (!summary?.incomeVsExpense) return [];
    const monthLabels = ['ene','feb','mar','abr','may','jun','jul','ago','sept','oct','nov','dic'];
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      months.push({ key, label: monthLabels[d.getMonth()] });
    }
    const agg = summary.incomeVsExpense.reduce((acc, item) => {
      const key = item.date.slice(0,7); // YYYY-MM
      if (!acc[key]) acc[key] = { income: 0, expense: 0 };
      acc[key].income += Number(item.income || 0);
      acc[key].expense += Number(item.expense || 0);
      return acc;
    }, {});
    return months.map(m => ({ month: m.label, income: agg[m.key]?.income || 0, expense: agg[m.key]?.expense || 0 }));
  }, [summary]);

  // Totales y porcentajes de métodos de pago
  const paymentTotals = useMemo(() => {
    const cash = Number(summary?.paymentMethods?.cash || 0);
    const card = Number(summary?.paymentMethods?.card || 0);
    const total = cash + card;
    const pct = (v) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0);
    return { cash, card, total, cashPct: pct(cash), cardPct: pct(card) };
  }, [summary]);

  // Uso por tarjeta, enriquecido con color y last4
  const perCardUsage = useMemo(() => {
    const map = summary?.perCard || {};
    return Object.keys(map).map((name) => {
      const info = cards.find((c) => c.name === name) || {};
      return {
        name,
        amount: Number(map[name] || 0),
        color: info.color || '#0ea5e9',
        last4: info.last4 || '',
      };
    });
  }, [summary, cards]);

  // Budget vs Actual progress (only meaningful for a specific month)
  const budgetProgress = useMemo(() => {
    if (!summary) return { budget: 0, actual: 0, remaining: 0, consumedPercent: 0 };
    const budget = Number(summary.budgetAmount || 0);
    const actual = Number(summary.totals?.expense || 0);
    const remaining = budget - actual;
    const consumedPercent = budget > 0 ? Math.round((actual / budget) * 100) : 0;
    return { budget, actual, remaining, consumedPercent };
  }, [summary]);

  // Color de barra con umbrales (30% restante -> naranja, 10% restante -> rojo)
  const barColorClass = useMemo(() => {
    const cp = budgetProgress.consumedPercent;
    if (budgetProgress.remaining < 0) return 'bg-rose-500'; // sobre presupuesto
    if (budgetProgress.budget > 0) {
      const remainingPct = 100 - cp; // porcentaje restante del presupuesto
      if (remainingPct <= 10) return 'bg-rose-500'; // rojo si falta 10% o menos
      if (remainingPct <= 30) return 'bg-orange-500'; // naranja si falta 30% o menos
    }
    return 'bg-emerald-500'; // verde en condiciones normales
  }, [budgetProgress]);

  const onExport = async () => {
    try {
      const year = new Date().getFullYear();
      const params = period === 'all' ? { period } : { period: `${year}-${period}` };
      const res = await api.get('/stats/export', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `transactions_${params.period || 'all'}.xlsx`;
      a.click(); window.URL.revokeObjectURL(url);
    } catch {
      alert('Export failed');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">Overview</h3>
          <select className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={period} onChange={(e)=>setPeriod(e.target.value)}>
            {monthOptions.map(m=> <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        {loading && <p className="text-gray-500">Loading...</p>}
        {error && <div className="px-3 py-2 rounded-md bg-rose-100 text-rose-700">{error}</div>}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Income</div>
              <div className="text-2xl font-semibold text-emerald-600">${summary.totals.income.toFixed(2)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Expenses</div>
              <div className="text-2xl font-semibold text-rose-600">${summary.totals.expense.toFixed(2)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Balance</div>
              <div className="text-2xl font-semibold">${(summary.totals.income - summary.totals.expense).toFixed(2)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Transactions</div>
              <div className="text-2xl font-semibold">{summary.totals.transactions}</div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">Income vs Expenses</h3>
          <button className="px-3 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-700" onClick={onExport}>Export XLSX</button>
        </div>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="expense" name="expenses" fill="#ef4444" />
              <Bar dataKey="income" name="income" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Budget vs Actual - Progress bar */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="text-lg font-semibold mb-3">Budget vs Actual</h3>
        {period === 'all' ? (
          <p className="text-gray-500">Select a specific month to compare against the monthly budget.</p>
        ) : summary?.budgetAmount == null ? (
          <p className="text-gray-500">No budget set for this month.</p>
        ) : (
          <div>
            {/* Progress bar */}
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-gray-600">Budget: <span className="font-medium">${budgetProgress.budget.toFixed(2)}</span></span>
              <span className="text-gray-600">Actual: <span className="font-medium text-rose-600">${budgetProgress.actual.toFixed(2)}</span></span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded overflow-hidden">
              <div
                className={`h-3 ${barColorClass} rounded`}
                style={{ width: `${Math.min(budgetProgress.consumedPercent, 100)}%` }}
              />
            </div>
            <div className="mt-2 text-sm">
              <span className="text-gray-600">Consumo:</span> <span className={`font-medium ${budgetProgress.remaining >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{budgetProgress.consumedPercent}%{budgetProgress.consumedPercent > 100 ? ' (sobre presupuesto)' : ''}</span>
            </div>
            <div className="mt-1 text-sm">
              <span className="text-gray-600">Estado restante:</span> <span className={`font-medium ${budgetProgress.remaining < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>${budgetProgress.remaining.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="text-lg font-semibold mb-3">Categories</h3>
        <div className="flex gap-6 flex-wrap items-start">
          <div style={{ width: 280, height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={summary?.categories || []} dataKey="amount" nameKey="name" outerRadius={100}>
                  {(summary?.categories || []).map((c, i) => <Cell key={i} fill={c.color || '#3b82f6'} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="divide-y divide-gray-100 flex-1">
            {(summary?.categories || []).map(c => (
              <li key={c.name} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ background:c.color || '#3b82f6' }}></span>
                  <span>{c.name}</span>
                </div>
                <span className="font-medium">${c.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Payment Methods & Credit Card Usage */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Payment Methods */}
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="text-lg font-semibold mb-3">Payment Methods</h3>
          <div className="space-y-3">
            {/* Cash card */}
            <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700">
                  {/* cash icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.25 7.5h19.5v9H2.25zM5.25 9.75h.75m12 0h.75M12 12.75a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>
                </span>
                <div>
                  <div className="text-xs text-gray-600">Cash</div>
                  <div className="text-lg font-semibold text-gray-900">${paymentTotals.cash.toFixed(2)}</div>
                </div>
              </div>
              <div className="text-sm text-gray-600">{paymentTotals.cashPct}%</div>
            </div>

            {/* Credit cards */}
            <div className="flex items-center justify-between rounded-lg border border-sky-100 bg-sky-50 p-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-sky-100 text-sky-700">
                  {/* card icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.25 7.5h19.5v9H2.25zM3 10.5h18M6 13.5h4"/></svg>
                </span>
                <div>
                  <div className="text-xs text-gray-600">Credit Cards</div>
                  <div className="text-lg font-semibold text-gray-900">${paymentTotals.card.toFixed(2)}</div>
                </div>
              </div>
              <div className="text-sm text-gray-600">{paymentTotals.cardPct}%</div>
            </div>
          </div>
          <div className="mt-3 text-right text-sm">
            <span className="text-gray-600">Total Spent</span>{' '}
            <span className="font-semibold">${paymentTotals.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Credit Card Usage */}
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Credit Card Usage</h3>
            {/* futuro: filtros o acciones */}
            <button className="p-2 rounded-md bg-gray-100 text-gray-700" title="Options" aria-label="options">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 12a1 1 0 102 0 1 1 0 10-2 0zm6 0a1 1 0 102 0 1 1 0 10-2 0zm6 0a1 1 0 102 0 1 1 0 10-2 0z"/></svg>
            </button>
          </div>
          <div className="space-y-3">
            {perCardUsage.length === 0 ? (
              <p className="text-gray-500">No hay gastos con tarjetas.</p>
            ) : (
              perCardUsage.map((c) => (
                <div key={c.name} className="flex items-center justify-between rounded-lg p-4 border" style={{ borderColor: c.color + '33' }}>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg" style={{ background: c.color + '22', color: c.color }}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.25 7.5h19.5v9H2.25zM3 10.5h18"/></svg>
                    </span>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{c.name}</div>
                      {c.last4 && <div className="text-xs text-gray-500">•••• {c.last4}</div>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900">${c.amount.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">Total spent</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}