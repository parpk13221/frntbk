// categories.js
const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { parent, featured, active } = req.query;
    const filter = {};
    if (parent === 'null') filter.parent = null;
    else if (parent) filter.parent = parent;
    if (featured === 'true') filter.isFeatured = true;
    if (active === 'true') filter.isActive = true;
    const categories = await Category.find(filter).populate('parent', 'name').sort('order name');
    res.json({ success: true, categories });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', authorize('super_admin','admin','manager'), async (req, res) => {
  try {
    const cat = await Category.create(req.body);
    res.status(201).json({ success: true, category: cat });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'A category with this name/slug already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', authorize('super_admin','admin','manager'), async (req, res) => {
  try {
    const update = { ...req.body };
    // findByIdAndUpdate bypasses the pre-save hook, so keep slug in sync on rename
    if (update.name) update.slug = update.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const cat = await Category.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, category: cat });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'A category with this name/slug already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', authorize('super_admin','admin'), async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
