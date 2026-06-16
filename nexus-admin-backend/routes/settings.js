const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');

// Dynamic settings model
const settingsSchema = new mongoose.Schema({ key: { type: String, unique: true }, value: mongoose.Schema.Types.Mixed }, { timestamps: true });
const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const settings = await Settings.find();
    const map = {};
    settings.forEach(s => map[s.key] = s.value);
    res.json({ success: true, settings: map });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/', authorize('super_admin','admin'), async (req, res) => {
  try {
    const updates = await Promise.all(
      Object.entries(req.body).map(([key, value]) =>
        Settings.findOneAndUpdate({ key }, { value }, { upsert: true, new: true })
      )
    );
    res.json({ success: true, settings: updates });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:key', async (req, res) => {
  try {
    const setting = await Settings.findOne({ key: req.params.key });
    res.json({ success: true, setting });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
