const mongoose = require('mongoose');

// ─── Shared sub-schemas ─────────────────────────────────────────────────────
const buttonSchema = new mongoose.Schema({
  label:  { type: String, default: 'Shop Now' },
  url:    { type: String, default: '/' },
  style:  { type: String, enum: ['primary','secondary','outline','ghost'], default: 'primary' },
  icon:   { type: String, default: '' },
  openNewTab: { type: Boolean, default: false }
}, { _id: false });

const backgroundSchema = new mongoose.Schema({
  type:    { type: String, enum: ['color','image','video','gradient'], default: 'color' },
  value:   { type: String, default: '#0a0a0a' },
  overlay: { type: String, default: '' },
  overlayOpacity: { type: Number, default: 0.5 }
}, { _id: false });

const animationSchema = new mongoose.Schema({
  type:     { type: String, enum: ['none','fade','slide','zoom','bounce'], default: 'none' },
  duration: { type: Number, default: 500 },
  delay:    { type: Number, default: 0 },
  easing:   { type: String, default: 'ease' }
}, { _id: false });

// ─── Section schema ──────────────────────────────────────────────────────────
const sectionSchema = new mongoose.Schema({
  id:       { type: String, required: true },
  type:     {
    type: String,
    enum: ['hero_slider','featured_products','trending_products','best_sellers','new_arrivals',
           'categories_grid','flash_sales','promo_banners','reviews','brand_showcase',
           'newsletter','footer_blocks','custom'],
    required: true
  },
  title:      { type: String, default: '' },
  subtitle:   { type: String, default: '' },
  isEnabled:  { type: Boolean, default: true },
  order:      { type: Number, default: 0 },

  // ── Layout ──────────────────────────────────────────────────────────────
  layout: {
    type:    { type: String, enum: ['grid','masonry','carousel','slider','card','full_width','multi_column'], default: 'grid' },
    columns: { type: Number, default: 4 },
    gap:     { type: Number, default: 16 },
    padding: { type: String, default: '40px 0' }
  },

  // ── Background ──────────────────────────────────────────────────────────
  background: { type: backgroundSchema, default: () => ({}) },
  animation:  { type: animationSchema,  default: () => ({}) },

  // ── Section-specific config (flexible) ──────────────────────────────────
  config: { type: mongoose.Schema.Types.Mixed, default: {} },

  // ── Hero slides ─────────────────────────────────────────────────────────
  slides: [{
    title:     String,
    subtitle:  String,
    image:     String,
    video:     String,
    buttons:   [buttonSchema],
    background:backgroundSchema,
    isEnabled: { type: Boolean, default: true }
  }],

  // ── Product references ───────────────────────────────────────────────────
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],

  // ── Promo / banner items ─────────────────────────────────────────────────
  items: [{
    title:      String,
    subtitle:   String,
    image:      String,
    icon:       String,
    link:       String,
    buttons:    [buttonSchema],
    countdown:  Date,
    badge:      String,
    order:      Number,
    isEnabled:  { type: Boolean, default: true }
  }],

  // ── Custom CSS / HTML ────────────────────────────────────────────────────
  customCss:  { type: String, default: '' },
  customHtml: { type: String, default: '' }
}, { _id: false });

// ─── Homepage document ───────────────────────────────────────────────────────
const homepageSchema = new mongoose.Schema({
  name:        { type: String, default: 'Homepage' },
  isPublished: { type: Boolean, default: false },
  publishedAt: { type: Date },
  sections:    { type: [sectionSchema], default: [] },

  // Global settings
  globalSettings: {
    primaryColor:    { type: String, default: '#f97316' },
    secondaryColor:  { type: String, default: '#3b82f6' },
    fontFamily:      { type: String, default: 'Inter' },
    containerWidth:  { type: String, default: '1280px' },
    sectionSpacing:  { type: Number, default: 80 }
  },

  // SEO
  seo: {
    title:       { type: String, default: '' },
    description: { type: String, default: '' },
    ogImage:     { type: String, default: '' }
  },

  // Draft snapshot (auto-saved)
  draft: { type: mongoose.Schema.Types.Mixed, default: null },
  lastDraftSaved: { type: Date },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Homepage', homepageSchema);
