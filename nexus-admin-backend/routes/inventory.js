// ─── routes/inventory.js ─────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// ─── GET /api/inventory/alerts ───────────────────────────────────────────────
// Low-stock + out-of-stock products that need attention.
router.get('/alerts', async (req, res) => {
  try {
    const [lowStock, outOfStock] = await Promise.all([
      Product.find({ trackStock: true, stock: { $gt: 0 }, $expr: { $lte: ['$stock', '$lowStockAlert'] } })
        .select('name sku thumbnail stock lowStockAlert price category')
        .populate('category', 'name')
        .sort('stock')
        .limit(100),
      Product.find({ trackStock: true, stock: 0 })
        .select('name sku thumbnail stock price category')
        .populate('category', 'name')
        .sort('-updatedAt')
        .limit(100)
    ]);
    res.json({
      success: true,
      lowStock,
      outOfStock,
      counts: { lowStock: lowStock.length, outOfStock: outOfStock.length }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/inventory/history/:id ──────────────────────────────────────────
// Stock movement log for one product.
router.get('/history/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .select('name sku stock lowStockAlert stockHistory')
      .populate('stockHistory.user', 'name');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const history = [...(product.stockHistory || [])].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    res.json({
      success: true,
      product: { _id: product._id, name: product.name, sku: product.sku, stock: product.stock, lowStockAlert: product.lowStockAlert },
      history
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/inventory/:id/adjust ──────────────────────────────────────────
// Convenience mirror of products/:id/inventory so inventory page can adjust too.
router.post('/:id/adjust', authorize('super_admin', 'admin', 'manager'), async (req, res) => {
  try {
    const { type, quantity, note } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const prev = product.stock;
    if (type === 'add') product.stock += Number(quantity);
    else if (type === 'remove') product.stock = Math.max(0, product.stock - Number(quantity));
    else if (type === 'adjust') product.stock = Number(quantity);
    else return res.status(400).json({ success: false, message: 'Invalid adjustment type' });

    product.stockHistory.push({ type, quantity: Number(quantity), note, user: req.user._id });
    await product.save();

    const io = req.app.get('io');
    if (product.stock === 0) io?.emit('inventory:out_of_stock', { productId: product._id, name: product.name });
    else if (product.stock <= product.lowStockAlert) io?.emit('inventory:low_stock', { productId: product._id, name: product.name, stock: product.stock });

    res.json({ success: true, product, prev, current: product.stock });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
