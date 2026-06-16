// customers.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Order = require('../models/Order');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, sort = '-createdAt' } = req.query;
    const filter = { role: 'customer' };
    if (search) filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
    const [customers, total] = await Promise.all([
      User.find(filter).sort(sort).skip((page-1)*limit).limit(Number(limit)),
      User.countDocuments(filter)
    ]);
    res.json({ success: true, customers, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total/limit) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [customer, orders] = await Promise.all([
      User.findById(req.params.id),
      Order.find({ customer: req.params.id }).sort('-createdAt').limit(10)
    ]);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, customer, orders });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
