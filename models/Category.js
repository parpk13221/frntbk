const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  slug:       { type: String, unique: true },
  description:{ type: String, default: '' },
  image:      { type: String, default: '' },
  icon:       { type: String, default: '' },
  parent:     { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  order:      { type: Number, default: 0 },
  isActive:   { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  seo: {
    metaTitle: String,
    metaDesc:  String
  },
  productCount: { type: Number, default: 0 }
}, { timestamps: true });

categorySchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }
  next();
});

module.exports = mongoose.model('Category', categorySchema);
