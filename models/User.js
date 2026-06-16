const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true },
  password:   { type: String, required: true, minlength: 8, select: false },
  role:       { type: String, enum: ['super_admin','admin','manager','editor','support','customer'], default: 'editor' },
  permissions:{ type: [String], default: [] },
  avatar:     { type: String, default: '' },
  isActive:   { type: Boolean, default: true },
  lastLogin:  { type: Date },
  loginHistory: [{
    ip:        String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(entered) {
  return await bcrypt.compare(entered, this.password);
};

userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
