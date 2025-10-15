import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { Card } from '../models/index.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const items = await Card.findAll({ where: { UserId: req.userId } });
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, color, last4 } = req.body;
    const l4 = String(last4||'').trim();
    if (!name) return res.status(400).json({ message: 'Name is required' });
    if (!/^#[0-9a-fA-F]{6}$/.test(String(color||'#0ea5e9'))) return res.status(400).json({ message: 'Invalid color' });
    if (!/^\d{4}$/.test(l4)) return res.status(400).json({ message: 'Last4 must be 4 digits' });
    const item = await Card.create({ name, color, last4: l4, UserId: req.userId });
    res.json(item);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const item = await Card.findOne({ where: { id: req.params.id, UserId: req.userId } });
    if (!item) return res.status(404).json({ message: 'Not found' });
    const { name, color, last4 } = req.body;
    if (last4 !== undefined && !/^\d{4}$/.test(String(last4))) {
      return res.status(400).json({ message: 'Last4 must be 4 digits' });
    }
    await item.update({ name, color, last4 });
    res.json(item);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const item = await Card.findOne({ where: { id: req.params.id, UserId: req.userId } });
    if (!item) return res.status(404).json({ message: 'Not found' });
    await item.destroy();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;