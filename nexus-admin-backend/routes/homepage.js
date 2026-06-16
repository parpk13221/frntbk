// ─── routes/homepage.js ──────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Homepage = require('../models/Homepage');
const { protect, authorize } = require('../middleware/auth');

// Singleton helper — there is always exactly one homepage document.
async function getOrCreateHomepage(userId) {
  let hp = await Homepage.findOne();
  if (!hp) hp = await Homepage.create({ name: 'Homepage', sections: [], createdBy: userId });
  return hp;
}

// ─── PUBLIC: published homepage (storefront) ─────────────────────────────────
router.get('/published', async (req, res) => {
  try {
    const hp = await Homepage.findOne({ isPublished: true })
      .populate('sections.products', 'name slug price salePrice thumbnail rating stock')
      .populate('sections.categories', 'name slug image icon');
    if (!hp) return res.status(404).json({ success: false, message: 'No published homepage' });
    res.json({ success: true, homepage: hp });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Everything below requires authentication
router.use(protect);

// ─── GET working homepage (admin) ────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const hp = await getOrCreateHomepage(req.user._id);
    res.json({ success: true, homepage: hp });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT global settings / SEO ───────────────────────────────────────────────
router.put('/settings', authorize('super_admin', 'admin', 'manager', 'editor'), async (req, res) => {
  try {
    const hp = await getOrCreateHomepage(req.user._id);
    if (req.body.globalSettings) hp.globalSettings = { ...hp.globalSettings.toObject?.() || hp.globalSettings, ...req.body.globalSettings };
    if (req.body.seo) hp.seo = { ...hp.seo, ...req.body.seo };
    if (req.body.name) hp.name = req.body.name;
    hp.updatedBy = req.user._id;
    await hp.save();
    res.json({ success: true, homepage: hp });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT reorder sections ────────────────────────────────────────────────────
// body: { order: ['sectionId1','sectionId2', ...] }
router.put('/sections/reorder', authorize('super_admin', 'admin', 'manager', 'editor'), async (req, res) => {
  try {
    const { order } = req.body;
    const hp = await getOrCreateHomepage(req.user._id);
    const byId = new Map(hp.sections.map(s => [s.id, s]));
    hp.sections = order.map((id, idx) => {
      const s = byId.get(id);
      if (s) s.order = idx;
      return s;
    }).filter(Boolean);
    hp.updatedBy = req.user._id;
    await hp.save();
    res.json({ success: true, sections: hp.sections });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST add section ────────────────────────────────────────────────────────
router.post('/sections', authorize('super_admin', 'admin', 'manager', 'editor'), async (req, res) => {
  try {
    const hp = await getOrCreateHomepage(req.user._id);
    const section = { id: uuidv4(), order: hp.sections.length, ...req.body };
    if (!section.type) return res.status(400).json({ success: false, message: 'Section type is required' });
    hp.sections.push(section);
    hp.updatedBy = req.user._id;
    await hp.save();
    res.status(201).json({ success: true, section: hp.sections[hp.sections.length - 1], homepage: hp });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT update section ──────────────────────────────────────────────────────
router.put('/sections/:id', authorize('super_admin', 'admin', 'manager', 'editor'), async (req, res) => {
  try {
    const hp = await getOrCreateHomepage(req.user._id);
    const section = hp.sections.find(s => s.id === req.params.id);
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });
    Object.entries(req.body).forEach(([k, v]) => { if (k !== 'id') section[k] = v; });
    hp.markModified('sections');
    hp.updatedBy = req.user._id;
    await hp.save();
    res.json({ success: true, section, homepage: hp });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE section ──────────────────────────────────────────────────────────
router.delete('/sections/:id', authorize('super_admin', 'admin', 'manager'), async (req, res) => {
  try {
    const hp = await getOrCreateHomepage(req.user._id);
    hp.sections = hp.sections.filter(s => s.id !== req.params.id);
    hp.updatedBy = req.user._id;
    await hp.save();
    res.json({ success: true, homepage: hp });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST duplicate section ──────────────────────────────────────────────────
router.post('/sections/:id/duplicate', authorize('super_admin', 'admin', 'manager', 'editor'), async (req, res) => {
  try {
    const hp = await getOrCreateHomepage(req.user._id);
    const original = hp.sections.find(s => s.id === req.params.id);
    if (!original) return res.status(404).json({ success: false, message: 'Section not found' });
    const copy = original.toObject ? original.toObject() : { ...original };
    copy.id = uuidv4();
    copy.title = `${copy.title || copy.type} (Copy)`;
    copy.order = hp.sections.length;
    hp.sections.push(copy);
    hp.updatedBy = req.user._id;
    await hp.save();
    res.status(201).json({ success: true, section: hp.sections[hp.sections.length - 1], homepage: hp });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH toggle section enabled ────────────────────────────────────────────
router.patch('/sections/:id/toggle', authorize('super_admin', 'admin', 'manager', 'editor'), async (req, res) => {
  try {
    const hp = await getOrCreateHomepage(req.user._id);
    const section = hp.sections.find(s => s.id === req.params.id);
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });
    section.isEnabled = !section.isEnabled;
    hp.markModified('sections');
    await hp.save();
    res.json({ success: true, section });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST publish ────────────────────────────────────────────────────────────
router.post('/publish', authorize('super_admin', 'admin', 'manager'), async (req, res) => {
  try {
    const hp = await getOrCreateHomepage(req.user._id);
    hp.isPublished = true;
    hp.publishedAt = new Date();
    hp.draft = null;
    hp.updatedBy = req.user._id;
    await hp.save();
    req.app.get('io')?.emit('homepage:published', { publishedAt: hp.publishedAt });
    res.json({ success: true, homepage: hp });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST save draft snapshot ────────────────────────────────────────────────
router.post('/draft', authorize('super_admin', 'admin', 'manager', 'editor'), async (req, res) => {
  try {
    const hp = await getOrCreateHomepage(req.user._id);
    if (Array.isArray(req.body.sections)) hp.sections = req.body.sections;
    hp.draft = req.body.draft || { sections: hp.sections };
    hp.lastDraftSaved = new Date();
    hp.updatedBy = req.user._id;
    await hp.save();
    res.json({ success: true, lastDraftSaved: hp.lastDraftSaved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Slide management (hero sliders) ─────────────────────────────────────────
router.post('/sections/:sid/slides', authorize('super_admin', 'admin', 'manager', 'editor'), async (req, res) => {
  try {
    const hp = await getOrCreateHomepage(req.user._id);
    const section = hp.sections.find(s => s.id === req.params.sid);
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });
    section.slides.push(req.body);
    await hp.save();
    res.status(201).json({ success: true, section });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/sections/:sid/slides/:index', authorize('super_admin', 'admin', 'manager', 'editor'), async (req, res) => {
  try {
    const hp = await getOrCreateHomepage(req.user._id);
    const section = hp.sections.find(s => s.id === req.params.sid);
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });
    const i = Number(req.params.index);
    if (!section.slides[i]) return res.status(404).json({ success: false, message: 'Slide not found' });
    Object.entries(req.body).forEach(([k, v]) => { section.slides[i][k] = v; });
    hp.markModified('sections');
    await hp.save();
    res.json({ success: true, section });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/sections/:sid/slides/:index', authorize('super_admin', 'admin', 'manager', 'editor'), async (req, res) => {
  try {
    const hp = await getOrCreateHomepage(req.user._id);
    const section = hp.sections.find(s => s.id === req.params.sid);
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });
    section.slides.splice(Number(req.params.index), 1);
    await hp.save();
    res.json({ success: true, section });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
