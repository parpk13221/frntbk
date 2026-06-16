// analytics.js
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/overview', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalRevenue, lastMonthRevenue, totalOrders, lastMonthOrders,
      totalCustomers, newCustomers, lowStockCount, outOfStockCount, totalProducts
    ] = await Promise.all([
      Order.aggregate([{ $match: { status: 'delivered', createdAt: { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      Order.aggregate([{ $match: { status: 'delivered', createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Order.countDocuments({ createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'customer', createdAt: { $gte: startOfMonth } }),
      Product.countDocuments({ stock: { $gt: 0, $lte: 5 }, trackStock: true }),
      Product.countDocuments({ stock: 0, trackStock: true }),
      Product.countDocuments({ status: 'active' })
    ]);

    const rev = totalRevenue[0]?.total || 0;
    const lastRev = lastMonthRevenue[0]?.total || 0;

    res.json({
      success: true,
      data: {
        revenue: { current: rev, last: lastRev, change: lastRev ? ((rev - lastRev) / lastRev * 100).toFixed(1) : 0 },
        orders: { current: totalOrders, last: lastMonthOrders, change: lastMonthOrders ? ((totalOrders - lastMonthOrders) / lastMonthOrders * 100).toFixed(1) : 0 },
        customers: { total: totalCustomers, new: newCustomers },
        inventory: { lowStock: lowStockCount, outOfStock: outOfStockCount, total: totalProducts }
      }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/revenue-chart', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));
    const data = await Order.aggregate([
      { $match: { status: { $in: ['delivered','completed'] }, createdAt: { $gte: startDate } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/top-products', async (req, res) => {
  try {
    const products = await Product.find({ status: 'active' }).sort('-salesCount').limit(10).select('name thumbnail price salesCount rating');
    res.json({ success: true, products });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
