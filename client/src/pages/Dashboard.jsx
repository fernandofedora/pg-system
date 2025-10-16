import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const monthOptions = [
  { label: 'All Time', value: 'all' },
  ...Array.from({ length: 12 }, (_, i) => ({ label: new Date(0, i).toLocaleString('en', { month: 'long' }), value: String(i+1).padStart(2, '0') }))
];

export default function Dashboard() {
  const [period, setPeriod] = useState('all');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const lineData = useMemo(() => {
    if (!summary?.incomeVsExpense) return [];
    return summary.incomeVsExpense.map(d => ({ date: d.date, income: d.income, expense: d.expense }));
  }, [summary]);

  // Budget vs Actual progress (only meaningful for a specific month)
  const budgetProgress = useMemo(() => {
    if (!summary) return { budget: 0, actual: 0, remaining: 0, consumedPercent: 0 };
    const budget = Number(summary.budgetAmount || 0);
    const actual = Number(summary.totals?.expense || 0);
    const remaining = budget - actual;
    const consumedPercent = budget > 0 ? Math.round((actual / budget) * 100) : 0;
    return { budget, actual, remaining, consumedPercent };
  }, [summary]);

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
            <LineChart data={lineData}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} />
              <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
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
                className={`h-3 ${budgetProgress.remaining >= 0 ? 'bg-emerald-500' : 'bg-rose-500'} rounded`}
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
    </div>
  );
}