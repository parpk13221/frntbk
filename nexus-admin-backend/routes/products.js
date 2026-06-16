const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');

// All routes require auth
router.use(protect);

// ─── GET all products (paginated, filtered, sorted) ─────────────────────────
router.get('/', async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search, status, category,
      isFeatured, isTrending, isBestSeller, isNewArrival,
      minPrice, maxPrice, inStock, sort = '-createdAt'
    } = req.query;

    const filter = {};
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (isFeatured === 'true') filter.isFeatured = true;
    if (isTrending === 'true') filter.isTrending = true;
    if (isBestSeller === 'true') filter.isBestSeller = true;
    if (isNewArrival === 'true') filter.isNewArrival = true;
    if (minPrice || maxPrice) filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
    if (inStock === 'true') filter.stock = { $gt: 0 };
    if (inStock === 'false') filter.stock = 0;

    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      Product.find(filter).populate('category', 'name slug').sort(sort).skip(skip).limit(Number(limit)),
      Product.countDocuments(filter)
    ]);

    res.json({
      success: true,
      products,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET single product ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category subcategory', 'name slug');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── CREATE product ──────────────────────────────────────────────────────────
router.post('/', authorize('super_admin','admin','manager'), async (req, res) => {
  try {
    const product = await Product.create({ ...req.body, createdBy: req.user._id });
    req.app.get('io').emit('product:created', { product });
    res.status(201).json({ success: true, product });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'SKU already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── UPDATE product ──────────────────────────────────────────────────────────
router.put('/:id', authorize('super_admin','admin','manager'), async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    ).populate('category', 'name slug');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Check low stock — emit alert
    if (product.trackStock && product.stock <= product.lowStockAlert) {
      req.app.get('io').emit('inventory:low_stock', {
        productId: product._id, name: product.name, stock: product.stock
      });
    }
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE product ──────────────────────────────────────────────────────────
router.delete('/:id', authorize('super_admin','admin'), async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    req.app.get('io').emit('product:deleted', { productId: req.params.id });
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DUPLICATE product ───────────────────────────────────────────────────────
router.post('/:id/duplicate', authorize('super_admin','admin','manager'), async (req, res) => {
  try {
    const original = await Product.findById(req.params.id).lean();
    if (!original) return res.status(404).json({ success: false, message: 'Product not found' });
    delete original._id;
    original.name = `${original.name} (Copy)`;
    original.slug = '';
    original.sku = `SKU-${Date.now()}`;
    original.status = 'draft';
    original.createdBy = req.user._id;
    const duplicate = await Product.create(original);
    res.status(201).json({ success: true, product: duplicate });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── BULK operations ─────────────────────────────────────────────────────────
router.post('/bulk/action', authorize('super_admin','admin','manager'), async (req, res) => {
  try {
    const { action, ids, data } = req.body;
    if (!ids?.length) return res.status(400).json({ success: false, message: 'No product IDs provided' });

    let result;
    switch (action) {
      case 'delete':
        result = await Product.deleteMany({ _id: { $in: ids } });
        break;
      case 'status':
        result = await Product.updateMany({ _id: { $in: ids } }, { status: data.status });
        break;
      case 'feature':
        result = await Product.updateMany({ _id: { $in: ids } }, { isFeatured: data.isFeatured });
        break;
      case 'category':
        result = await Product.updateMany({ _id: { $in: ids } }, { category: data.category });
        break;
      case 'price_adjust':
        const products = await Product.find({ _id: { $in: ids } });
        await Promise.all(products.map(p => {
          if (data.type === 'percentage') p.price = Math.round(p.price * (1 + data.value / 100));
          else p.price = Math.max(0, p.price + data.value);
          return p.save();
        }));
        result = { modifiedCount: products.length };
        break;
      default:
        return res.status(400).json({ success: false, message: 'Unknown bulk action' });
    }
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Inventory adjustment ────────────────────────────────────────────────────
router.post('/:id/inventory', authorize('super_admin','admin','manager'), async (req, res) => {
  try {
    const { type, quantity, note } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const prev = product.stock;
    if (type === 'add') product.stock += Number(quantity);
    else if (type === 'remove') product.stock = Math.max(0, product.stock - Number(quantity));
    else if (type === 'adjust') product.stock = Number(quantity);

    product.stockHistory.push({ type, quantity: Number(quantity), note, user: req.user._id });
    await product.save();

    if (product.stock === 0) req.app.get('io').emit('inventory:out_of_stock', { productId: product._id, name: product.name });
    else if (product.stock <= product.lowStockAlert) req.app.get('io').emit('inventory:low_stock', { productId: product._id, name: product.name, stock: product.stock });

    res.json({ success: true, product, prev, current: product.stock });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── CSV / Excel Export ──────────────────────────────────────────────────────
router.get('/export/csv', authorize('super_admin','admin','manager'), async (req, res) => {
  try {
    const products = await Product.find({}).populate('category', 'name').lean();
    const headers = ['Name','SKU','Price','Sale Price','Stock','Status','Category','Tags','Featured','Trending','Best Seller'];
    const rows = products.map(p => [
      p.name, p.sku, p.price, p.salePrice || '', p.stock,
      p.status, p.category?.name || '', (p.tags || []).join('|'),
      p.isFeatured, p.isTrending, p.isBestSeller
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=products.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
