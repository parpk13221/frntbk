// ─── orders.js ──────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search, paymentStatus, sort = '-createdAt' } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (search) filter.$or = [
      { orderNumber: { $regex: search, $options: 'i' } },
      { customerEmail: { $regex: search, $options: 'i' } },
      { customerName: { $regex: search, $options: 'i' } }
    ];
    const [orders, total] = await Promise.all([
      Order.find(filter).populate('customer', 'name email').sort(sort)
        .skip((page-1)*limit).limit(Number(limit)),
      Order.countDocuments(filter)
    ]);
    res.json({ success: true, orders, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total/limit) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('customer', 'name email avatar');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, order });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id/status', authorize('super_admin','admin','manager','support'), async (req, res) => {
  try {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    order.status = status;
    order.statusHistory.push({ status, note, updatedBy: req.user._id });
    await order.save();
    req.app.get('io').emit('order:status_updated', { orderId: order._id, orderNumber: order.orderNumber, status });
    res.json({ success: true, order });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', authorize('super_admin','admin','manager'), async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, order });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
