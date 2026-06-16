const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name:      { type: String, required: true },
  sku:       { type: String, default: '' },
  image:     { type: String, default: '' },
  variant:   { type: String, default: '' },
  price:     { type: Number, required: true, min: 0 },
  quantity:  { type: Number, required: true, min: 1 },
  subtotal:  { type: Number, required: true, min: 0 }
}, { _id: false });

const addressSchema = new mongoose.Schema({
  fullName: String,
  phone:    String,
  line1:    String,
  line2:    String,
  city:     String,
  state:    String,
  postcode: String,
  country:  { type: String, default: 'US' }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber:   { type: String, unique: true, index: true },

  // ── Customer ───────────────────────────────────────────────────────────────
  customer:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerName:  { type: String, default: '' },
  customerEmail: { type: String, default: '', lowercase: true, index: true },
  customerPhone: { type: String, default: '' },

  // ── Items ──────────────────────────────────────────────────────────────────
  items:         { type: [orderItemSchema], default: [] },

  // ── Money ──────────────────────────────────────────────────────────────────
  subtotal:      { type: Number, default: 0 },
  discount:      { type: Number, default: 0 },
  tax:           { type: Number, default: 0 },
  shipping:      { type: Number, default: 0 },
  total:         { type: Number, default: 0 },
  currency:      { type: String, default: 'USD' },

  // ── Fulfilment ─────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['pending','processing','shipped','delivered','completed','cancelled','refunded','on_hold'],
    default: 'pending',
    index: true
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid','paid','partially_paid','refunded','failed'],
    default: 'unpaid'
  },
  paymentMethod: { type: String, default: '' },
  shippingMethod:{ type: String, default: '' },
  trackingNumber:{ type: String, default: '' },

  shippingAddress: { type: addressSchema, default: () => ({}) },
  billingAddress:  { type: addressSchema, default: () => ({}) },

  notes:         { type: String, default: '' },

  statusHistory: [{
    status:    String,
    note:      String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Auto-generate a human-friendly order number
orderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    this.orderNumber = `ORD-${Date.now().toString().slice(-8)}-${rand}`;
  }
  // Keep subtotal/total coherent if not explicitly provided
  if (this.isNew && (!this.subtotal || this.subtotal === 0) && this.items?.length) {
    this.subtotal = this.items.reduce((s, i) => s + (i.subtotal || i.price * i.quantity), 0);
  }
  if (this.isNew && (!this.total || this.total === 0)) {
    this.total = this.subtotal - (this.discount || 0) + (this.tax || 0) + (this.shipping || 0);
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
