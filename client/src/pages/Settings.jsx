import { useEffect, useState } from 'react';
import api from '../api';

export default function Settings() {
  const [categories, setCategories] = useState([]);
  const [cards, setCards] = useState([]);
  const [catForm, setCatForm] = useState({ name:'', type:'expense', color:'#3b82f6' });
  const [cardForm, setCardForm] = useState({ name:'', color:'#3b82f6' });

  const load = async () => {
    const [catRes, cardRes] = await Promise.all([api.get('/categories'), api.get('/cards')]);
    setCategories(catRes.data); setCards(cardRes.data);
  };
  useEffect(()=>{ load(); },[]);

  const addCategory = async (e) => {
    e.preventDefault();
    await api.post('/categories', catForm);
    setCatForm({ name:'', type:'expense', color:'#3b82f6' });
    load();
  };

  const addCard = async (e) => {
    e.preventDefault();
    await api.post('/cards', cardForm);
    setCardForm({ name:'', color:'#3b82f6' });
    load();
  };

  const deleteCategory = async (id) => {
    try {
      await api.delete(`/categories/${id}`);
      load();
    } catch {
      alert('Cannot delete category in use');
    }
  };

  const deleteCard = async (id) => {
    await api.delete(`/cards/${id}`);
    load();
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="text-lg font-semibold mb-3">Categories</h3>
        <form className="space-y-3" onSubmit={addCategory}>
          <div className="flex gap-3 flex-wrap">
            <input className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Category Name" value={catForm.name} onChange={(e)=>setCatForm(v=>({ ...v, name:e.target.value }))} required />
            <select className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={catForm.type} onChange={(e)=>setCatForm(v=>({ ...v, type:e.target.value }))}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <input className="border border-gray-300 rounded-md px-2 py-2" type="color" value={catForm.color} onChange={(e)=>setCatForm(v=>({ ...v, color:e.target.value }))} />
            <button className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700" type="submit">Add</button>
          </div>
        </form>
        <ul className="divide-y divide-gray-100 mt-3">
          {categories.map(cat => (
            <li key={cat.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full" style={{ background:cat.color }}></span>
                <span>{cat.name}</span>
                <span className="text-xs text-gray-500">({cat.type})</span>
              </div>
              <button className="px-3 py-2 rounded-md bg-rose-600 text-white hover:bg-rose-700" onClick={()=>deleteCategory(cat.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="text-lg font-semibold mb-3">Credit Cards</h3>
        <form className="space-y-3" onSubmit={addCard}>
          <div className="flex gap-3 flex-wrap">
            <input className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Card Name" value={cardForm.name} onChange={(e)=>setCardForm(v=>({ ...v, name:e.target.value }))} required />
            <input className="border border-gray-300 rounded-md px-2 py-2" type="color" value={cardForm.color} onChange={(e)=>setCardForm(v=>({ ...v, color:e.target.value }))} />
            <button className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700" type="submit">Add</button>
          </div>
        </form>
        <ul className="divide-y divide-gray-100 mt-3">
          {cards.map(card => (
            <li key={card.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full" style={{ background:card.color }}></span>
                <span>{card.name}</span>
              </div>
              <button className="px-3 py-2 rounded-md bg-rose-600 text-white hover:bg-rose-700" onClick={()=>deleteCard(card.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}