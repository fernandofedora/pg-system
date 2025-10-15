import { useEffect, useState } from 'react';
import api from '../api';
import { formatAmount } from '../utils/format';

export default function Transactions() {
  const [categories, setCategories] = useState([]);
  const [cards, setCards] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [budgetDeleteId, setBudgetDeleteId] = useState(null);

  const [newTx, setNewTx] = useState({ type:'expense', description:'', categoryId:'', amount:'', date:'', method:'cash', cardId:'' });

  const [budget, setBudget] = useState({ month:'', year:'', amount:'' });
  const [budgets, setBudgets] = useState([]);

  // Inline editing state
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ type:'expense', description:'', categoryId:'', amount:'', date:'', paymentMethod:'cash', cardId:'' });

  const load = async () => {
    try {
      const [catRes, cardRes, trxRes, budRes] = await Promise.all([
        api.get('/categories'), api.get('/cards'), api.get('/transactions'), api.get('/budgets')
      ]);
      setCategories(catRes.data);
      setCards(cardRes.data);
      setTransactions(trxRes.data);
      setBudgets(budRes.data);
      setError(''); // clear previous error on success
    } catch { setError('Failed to load data'); }
  };

  useEffect(()=>{ load(); },[]);
  // auto-dismiss banners
  useEffect(() => { if (!success) return; const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); }, [success]);
  useEffect(() => { if (!error) return; const t = setTimeout(() => setError(''), 6000); return () => clearTimeout(t); }, [error]);

  

  // Formulario unificado para agregar transacciones (Expense/Income)
  const addTransaction = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        type: newTx.type,
        description: newTx.description,
        categoryId: newTx.categoryId || null,
        amount: parseFloat(newTx.amount || 0),
        date: newTx.date,
        paymentMethod: newTx.type === 'expense' ? (newTx.method || 'cash') : 'cash',
        cardId: newTx.type === 'expense' && newTx.method === 'card' ? (newTx.cardId || null) : null,
      };
      if (payload.type === 'expense' && payload.paymentMethod === 'card' && !payload.cardId) {
        setSuccess('');
        setError('Please select a card for card payments');
        return;
      }
      await api.post('/transactions', payload);
      setNewTx({ type:'expense', description:'', categoryId:'', amount:'', date:'', method:'cash', cardId:'' });
      setError('');
      setSuccess('Transaction added');
      load();
    } catch {
      setSuccess('');
      setError('Failed to add transaction');
    }
  };

  const setMonthlyBudget = async (e) => {
    e.preventDefault();
    try {
      await api.post('/budgets', { month: budget.month, year: budget.year, amount: parseFloat(budget.amount || 0) });
      setBudget({ month:'', year:'', amount:'' });
      setError('');
      setSuccess('Budget set');
      load();
    } catch{ setSuccess(''); setError('Failed to set budget'); }
  };

const DELETE_TRANSACTION_LEGACY = async () => { /* replaced by modal-based delete flow */ };
  // if(!confirm('Delete transaction?')) return;
  // try {
  //   await api.delete(`/transactions/${id}`);
  //   setError('');
  //   load();
  // } catch { setError('Failed to delete transaction'); }

  // Inline edit handlers
  const startEdit = (t) => {
    setEditingId(t.id);
    setEditData({
      type: t.type,
      description: t.description || '',
      categoryId: t.CategoryId || t.Category?.id || '',
      amount: (t.amount ?? '').toString(),
      date: t.date || '',
      paymentMethod: t.paymentMethod || (t.type==='income' ? 'cash' : 'cash'),
      cardId: t.CardId || t.Card?.id || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    try {
      const payload = { ...editData, amount: parseFloat(editData.amount || 0) };
      if (payload.type === 'income') { payload.paymentMethod = 'cash'; payload.cardId = null; }
      if (payload.type === 'expense' && payload.paymentMethod === 'card' && !payload.cardId) {
        setError('Please select a card for card payments');
        return;
      }
      await api.put(`/transactions/${editingId}`, payload);
      setEditingId(null);
      setError('');
      setSuccess('Changes saved');
      load();
    } catch {
      setSuccess('');
      setError('Failed to save changes');
    }
  };

  // Confirm deletion using modal-based flow
  const confirmDelete = async () => {
    if (deleteTargetId === null) return;
    try {
      await api.delete(`/transactions/${deleteTargetId}`);
      setDeleteTargetId(null);
      setError('');
      setSuccess('Transaction deleted');
      load();
    } catch {
      setSuccess('');
      setError('Failed to delete transaction');
    }
  };
  // Confirmación de eliminación de presupuesto
  const confirmDeleteBudget = async () => {
    if (budgetDeleteId === null) return;
    try {
      await api.delete(`/budgets/${budgetDeleteId}`);
      setBudgetDeleteId(null);
      setError('');
      setSuccess('Budget deleted');
      load();
    } catch {
      setSuccess('');
      setError('Failed to delete budget');
    }
  };
  const filtered = transactions.filter(t => typeFilter==='all' || t.type===typeFilter);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {error && (
        <Banner kind="error" message={error} onClose={()=>setError('')} />
      )}
      {success && (
        <Banner kind="success" message={success} onClose={()=>setSuccess('')} />
      )}
      <ConfirmModal
        open={deleteTargetId !== null}
        title="Delete transaction"
        message="Are you sure you want to delete this transaction? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={()=>setDeleteTargetId(null)}
      />
      <ConfirmModal
        open={budgetDeleteId !== null}
        title="Delete budget"
        message="Are you sure you want to delete this budget?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteBudget}
        onCancel={()=>setBudgetDeleteId(null)}
      />
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="text-lg font-semibold mb-3">Monthly Budget</h3>
          <form className="space-y-3" onSubmit={setMonthlyBudget}>
            <div className="flex gap-3 flex-wrap">
              <select className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={budget.month} onChange={(e)=>setBudget(v=>({ ...v, month:e.target.value }))} required>
                <option value="">Month</option>
                {Array.from({length:12},(_,i)=> <option key={i+1} value={String(i+1).padStart(2,'0')}>{new Date(0,i).toLocaleString('es',{ month:'long'})}</option>)}
              </select>
              <input className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" type="number" placeholder="Year" value={budget.year} onChange={(e)=>setBudget(v=>({ ...v, year:e.target.value }))} required />
              <input className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" type="number" step="0.01" placeholder="Amount" value={budget.amount} onChange={(e)=>setBudget(v=>({ ...v, amount:e.target.value }))} required />
              <button className="px-3 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-700" type="submit">Save Budget</button>
            </div>
          </form>
          <ul className="divide-y divide-gray-100 mt-3">
            {budgets.map(b => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <span>{String(b.month).padStart(2,'0')}/{b.year}</span>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{formatAmount(b.amount)}</span>
                  <button className="px-2 py-1 rounded-md bg-rose-600 text-white hover:bg-rose-700" onClick={()=>setBudgetDeleteId(b.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6 border-t pt-4">
            <h3 className="text-lg font-semibold mb-3">Add Transaction</h3>
            <div className="inline-flex rounded-md shadow-sm mb-3" role="group">
              <button type="button" className={`${newTx.type==='expense' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'} px-3 py-2 border rounded-l-md`} onClick={()=>setNewTx(v=>({ ...v, type:'expense', method:'cash', cardId:'' }))}>Expense</button>
              <button type="button" className={`${newTx.type==='income' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'} px-3 py-2 border rounded-r-md`} onClick={()=>setNewTx(v=>({ ...v, type:'income', method:'cash', cardId:'' }))}>Income</button>
            </div>
            <form className="space-y-3" onSubmit={addTransaction}>
              <input className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Description" value={newTx.description} onChange={(e)=>setNewTx(v=>({ ...v, description:e.target.value }))} required />
              <div className="flex gap-3 flex-wrap">
                <input className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" type="number" step="0.01" placeholder="Amount" value={newTx.amount} onChange={(e)=>setNewTx(v=>({ ...v, amount:e.target.value }))} required />
                <input className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" type="date" value={newTx.date} onChange={(e)=>setNewTx(v=>({ ...v, date:e.target.value }))} required />
              </div>
              <div className="flex gap-3 flex-wrap">
                <select className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={newTx.categoryId} onChange={(e)=>setNewTx(v=>({ ...v, categoryId:e.target.value }))} required>
                  <option value="">Category</option>
                  {categories.filter(c=>c.type===newTx.type).map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {newTx.type==='expense' && (
                  <>
                    <select className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={newTx.method} onChange={(e)=>setNewTx(v=>({ ...v, method:e.target.value }))}>
                      <option value="cash">Cash</option>
                      <option value="card">Credit Card</option>
                    </select>
                    {newTx.method==='card' && (
                      <select className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={newTx.cardId} onChange={(e)=>setNewTx(v=>({ ...v, cardId:e.target.value }))} required>
                        <option value="">Select Card</option>
                        {cards.map(card => <option key={card.id} value={card.id}>{card.name}</option>)}
                      </select>
                    )}
                  </>
                )}
              </div>
              <button className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700" type="submit">{newTx.type==='expense' ? 'Add Expense' : 'Add Income'}</button>
            </form>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4 md:col-span-2">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold">Transaction History</h3>
            <select className="border border-gray-300 rounded-md px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={typeFilter} onChange={(e)=>setTypeFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-28">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-[30%]">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-32">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide w-28">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-32">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-32">Payment</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide w-40">Actions</th>
                </tr>
              </thead>
              <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  {editingId === t.id ? (
                    <>
                      <td className="px-4 py-2 align-middle">
                        <select className="border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={editData.type} onChange={(e)=>setEditData(v=>({ ...v, type:e.target.value, paymentMethod: e.target.value==='income' ? 'cash' : v.paymentMethod }))}>
                          <option value="expense">expense</option>
                          <option value="income">income</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <input className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={editData.description} onChange={(e)=>setEditData(v=>({ ...v, description:e.target.value }))} />
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <select className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={editData.categoryId} onChange={(e)=>setEditData(v=>({ ...v, categoryId:e.target.value }))}>
                          <option value="">Category</option>
                          {categories.filter(c=>c.type===editData.type).map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2 align-middle text-right">
                        <input className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-28 text-right" type="number" step="0.01" value={editData.amount} onChange={(e)=>setEditData(v=>({ ...v, amount:e.target.value }))} />
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <input className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" type="date" value={editData.date} onChange={(e)=>setEditData(v=>({ ...v, date:e.target.value }))} />
                      </td>
                      <td className="px-4 py-2 align-middle">
                        {editData.type==='expense' ? (
                          <div className="flex items-center gap-2">
                            <select className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={editData.paymentMethod} onChange={(e)=>setEditData(v=>({ ...v, paymentMethod:e.target.value }))}>
                              <option value="cash">Cash</option>
                              <option value="card">Credit Card</option>
                            </select>
                            {editData.paymentMethod==='card' && (
                              <select className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={editData.cardId || ''} onChange={(e)=>setEditData(v=>({ ...v, cardId:e.target.value }))}>
                                <option value="">Select Card</option>
                                {cards.map(card => <option key={card.id} value={card.id}>{card.name}</option>)}
                              </select>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">Cash</span>
                        )}
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <div className="flex items-center justify-end gap-2">
                          <button className="h-9 px-3 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700" onClick={saveEdit}>Save</button>
                          <button className="h-9 px-3 text-sm rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300" onClick={cancelEdit}>Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2 align-middle">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${t.type==='expense' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{t.type}</span>
                      </td>
                      <td className="px-4 py-2 align-middle truncate">{t.description}</td>
                      <td className="px-4 py-2 align-middle">{t.Category?.name || ''}</td>
                      <td className={`px-4 py-2 align-middle text-right ${t.type==='expense' ? 'text-rose-600' : 'text-emerald-600'}`}>{formatAmount(t.amount)}</td>
                      <td className="px-4 py-2 align-middle">{t.date}</td>
                      <td className="px-4 py-2 align-middle">{t.paymentMethod==='card' ? (t.Card?.name || 'Card') : 'Cash'}</td>
                      <td className="px-4 py-2 align-middle">
                        <div className="flex items-center justify-end gap-2">
                          <button className="h-9 px-3 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700" onClick={()=>startEdit(t)}>Edit</button>
                          <button className="h-9 px-3 text-sm rounded-md bg-rose-600 text-white hover:bg-rose-700" onClick={()=>setDeleteTargetId(t.id)}>Delete</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>
      </div>

      
    </div>
  );
}

function Banner({ kind, message, onClose }) {
  const base = 'relative rounded-md p-4 border';
  const theme = kind === 'error'
    ? 'bg-rose-50 border-rose-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return (
    <div className={`${base} ${theme}`}>
      <div className="pr-8">{message}</div>
      <button type="button" aria-label="Close" className="absolute top-2 right-2 hover:opacity-80" onClick={onClose}>×</button>
    </div>
  );
}
function ConfirmModal({ open, title, message, confirmText = 'Delete', cancelText = 'Cancel', onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full">
        <h4 className="text-lg font-semibold mb-2">{title}</h4>
        <p className="text-gray-600 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-2 rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300" onClick={onCancel}>{cancelText}</button>
          <button className="px-3 py-2 rounded-md bg-rose-600 text-white hover:bg-rose-700" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}