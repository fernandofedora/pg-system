import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { Transaction, Category, Card, Budget } from '../models/index.js';
import XLSX from 'xlsx';
import { Op } from 'sequelize'

const router = express.Router();
router.use(authMiddleware);

// Helper to get period filter
const periodFilter = (month, year) => {
  if (!month || !year) return {};
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { date: { $between: [start.toISOString().slice(0,10), end.toISOString().slice(0,10)] } };
};

router.get('/summary', async (req, res) => {
  const { month, year } = req.query;
  const m = Number(month), y = Number(year)
  const start = month && year ? `${y}-${String(m).padStart(2,'0')}-01` : null
  const end = month && year ? `${y}-${String(m).padStart(2,'0')}-${String(new Date(y, m, 0).getDate()).padStart(2,'0')}` : null
  const where = { UserId: req.userId, ...(start && end ? { date: { [Op.between]: [start, end] } } : {}) }
  const txs = await Transaction.findAll({ where, include: [Category, Card] })
  const income = txs.filter(t=>t.type==='income').reduce((a,b)=>a+Number(b.amount),0);
  const expense = txs.filter(t=>t.type==='expense').reduce((a,b)=>a+Number(b.amount),0);
  const balance = income - expense;
  const perCategory = {};
  txs.filter(t=>t.type==='expense').forEach(t=>{
    const name = t.Category?.name || 'Uncategorized';
    perCategory[name] = (perCategory[name]||0)+Number(t.amount);
  });
  const paymentMethods = {
    cash: txs.filter(t=>t.paymentMethod==='cash' && t.type==='expense').reduce((a,b)=>a+Number(b.amount),0),
    cards: txs.filter(t=>t.paymentMethod==='card' && t.type==='expense').reduce((a,b)=>a+Number(b.amount),0)
  };
  const perCard = {};
  txs.filter(t=>t.paymentMethod==='card' && t.type==='expense').forEach(t=>{
    const name = t.Card?.name || 'Unknown';
    perCard[name] = (perCard[name]||0)+Number(t.amount);
  });
  const budget = month && year ? await Budget.findOne({ where: { UserId: req.userId, month: Number(month), year: Number(year) } }) : null;
  res.json({ income, expense, balance, transactionsCount: txs.length, perCategory, paymentMethods, perCard, budgetAmount: budget?.amount || null, transactions: txs });
});

router.get('/export', async (req, res) => {
  const { month, year } = req.query;
  const m = Number(month), y = Number(year)
  const start = month && year ? `${y}-${String(m).padStart(2,'0')}-01` : null
  const end = month && year ? `${y}-${String(m).padStart(2,'0')}-${String(new Date(y, m, 0).getDate()).padStart(2,'0')}` : null
  const where = { UserId: req.userId, ...(start && end ? { date: { [Op.between]: [start, end] } } : {}) }
  const txs = await Transaction.findAll({ where, include: [Category, Card] })
  const rows = txs.map(t=>({
    Type: t.type,
    Description: t.description,
    Category: t.Category?.name || '',
    Amount: Number(t.amount),
    Date: t.date,
    PaymentMethod: t.paymentMethod,
    Card: t.Card?.name || ''
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=transactions.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

export default router;