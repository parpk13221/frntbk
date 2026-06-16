const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const variantSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  sku:      { type: String, default: () => `VAR-${uuidv4().slice(0,8).toUpperCase()}` },
  price:    { type: Number, required: true },
  salePrice:{ type: Number },
  stock:    { type: Number, default: 0 },
  attributes: mongoose.Schema.Types.Mixed,
  image:    { type: String },
  barcode:  { type: String }
});

const productSchema = new mongoose.Schema({
  // ── Core ─────────────────────────────────────────────────────────────────
  name:        { type: String, required: true, trim: true, index: true },
  slug:        { type: String, unique: true, index: true },
  description: { type: String, default: '' },
  shortDesc:   { type: String, default: '' },

  // ── Media ────────────────────────────────────────────────────────────────
  thumbnail:   { type: String, default: '' },
  gallery:     [{ url: String, alt: String, publicId: String }],
  video:       { type: String, default: '' },

  // ── Pricing ──────────────────────────────────────────────────────────────
  price:       { type: Number, required: true, min: 0 },
  salePrice:   { type: Number, default: null },
  costPrice:   { type: Number, default: 0 },
  currency:    { type: String, default: 'USD' },

  // ── Inventory ────────────────────────────────────────────────────────────
  sku:         { type: String, unique: true, default: () => `SKU-${uuidv4().slice(0,8).toUpperCase()}` },
  barcode:     { type: String, default: '' },
  stock:       { type: Number, default: 0, min: 0 },
  lowStockAlert: { type: Number, default: 5 },
  trackStock:  { type: Boolean, default: true },
  allowBackorder: { type: Boolean, default: false },
  weight:      { type: Number, default: 0 },
  dimensions:  { length: Number, width: Number, height: Number },

  // ── Classification ───────────────────────────────────────────────────────
  category:    { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  subcategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  tags:        [{ type: String, trim: true }],
  brand:       { type: String, default: '' },
  attributes:  [{ name: String, values: [String] }],

  // ── Variants ────────────────────────────────────────────────────────────
  hasVariants: { type: Boolean, default: false },
  variants:    [variantSchema],

  // ── Status / Flags ───────────────────────────────────────────────────────
  status:      { type: String, enum: ['active','draft','hidden','archived'], default: 'draft' },
  isFeatured:  { type: Boolean, default: false },
  isTrending:  { type: Boolean, default: false },
  isBestSeller:{ type: Boolean, default: false },
  isNewArrival:{ type: Boolean, default: false },
  isDigital:   { type: Boolean, default: false },
  downloadUrl: { type: String, default: '' },

  // ── SEO ──────────────────────────────────────────────────────────────────
  seo: {
    metaTitle:  { type: String, default: '' },
    metaDesc:   { type: String, default: '' },
    keywords:   [String]
  },

  // ── Analytics ────────────────────────────────────────────────────────────
  views:       { type: Number, default: 0 },
  salesCount:  { type: Number, default: 0 },
  rating:      { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },

  // ── Inventory Log ───────────────────────────────────────────────────────
  stockHistory: [{
    type:      { type: String, enum: ['add','remove','adjust','sale','return'] },
    quantity:  Number,
    note:      String,
    user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Auto-generate slug
productSchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
  }
  next();
});

// Virtual: is on sale
productSchema.virtual('isOnSale').get(function() {
  return this.salePrice && this.salePrice < this.price;
});

// Virtual: stock status
productSchema.virtual('stockStatus').get(function() {
  if (!this.trackStock) return 'in_stock';
  if (this.stock === 0) return 'out_of_stock';
  if (this.stock <= this.lowStockAlert) return 'low_stock';
  return 'in_stock';
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
