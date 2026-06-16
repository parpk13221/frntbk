// ─── config/seed.js ──────────────────────────────────────────────────────────
// Usage: npm run seed
// Creates a default super_admin and a small set of demo data so the dashboard
// is not empty on first boot. Safe to re-run — it skips records that exist.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Order = require('../models/Order');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nexus-admin';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@nexusadmin.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123456';

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // ── Admin ──────────────────────────────────────────────────────────────────
  let admin = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
  if (!admin) {
    admin = await User.create({
      name: 'Platform Admin',
      email: ADMIN_EMAIL.toLowerCase(),
      password: ADMIN_PASSWORD,
      role: 'super_admin',
      isActive: true
    });
    console.log(`👑 Created super_admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } else {
    console.log('👑 Admin already exists, skipping');
  }

  // ── A couple of demo customers ───────────────────────────────────────────────
  const customerSeeds = [
    { name: 'Ava Customer', email: 'ava@example.com' },
    { name: 'Liam Buyer',   email: 'liam@example.com' }
  ];
  const customers = [];
  for (const c of customerSeeds) {
    let u = await User.findOne({ email: c.email });
    if (!u) u = await User.create({ ...c, password: 'Customer@123', role: 'customer' });
    customers.push(u);
  }

  // ── Categories ───────────────────────────────────────────────────────────────
  const catSeeds = ['Apparel', 'Electronics', 'Home & Living', 'Accessories'];
  const categories = {};
  for (const name of catSeeds) {
    let cat = await Category.findOne({ name });
    if (!cat) cat = await Category.create({ name, isActive: true, isFeatured: name === 'Electronics' });
    categories[name] = cat;
  }
  console.log(`🗂  Categories ready: ${Object.keys(categories).join(', ')}`);

  // ── Products ─────────────────────────────────────────────────────────────────
  const productSeeds = [
    { name: 'Aurora Wireless Headphones', price: 199, salePrice: 149, stock: 42, category: 'Electronics', isFeatured: true, isBestSeller: true, status: 'active', salesCount: 312, rating: 4.7 },
    { name: 'Nimbus Cotton Hoodie',       price: 79,  stock: 8,  category: 'Apparel', isTrending: true, status: 'active', lowStockAlert: 10, salesCount: 188, rating: 4.4 },
    { name: 'Ember Smart Lamp',           price: 59,  stock: 0,  category: 'Home & Living', status: 'active', isNewArrival: true, salesCount: 64, rating: 4.2 },
    { name: 'Drift Leather Wallet',       price: 45,  salePrice: 35, stock: 120, category: 'Accessories', status: 'active', isBestSeller: true, salesCount: 421, rating: 4.8 },
    { name: 'Pulse Mechanical Keyboard',  price: 129, stock: 3,  category: 'Electronics', status: 'active', isFeatured: true, lowStockAlert: 5, salesCount: 254, rating: 4.6 },
    { name: 'Cloud Lounge Chair',         price: 349, stock: 15, category: 'Home & Living', status: 'draft', salesCount: 12, rating: 4.1 }
  ];
  const products = [];
  for (const p of productSeeds) {
    let prod = await Product.findOne({ name: p.name });
    if (!prod) {
      prod = await Product.create({
        ...p,
        category: categories[p.category]._id,
        createdBy: admin._id,
        tags: [p.category.toLowerCase()]
      });
    }
    products.push(prod);
  }
  console.log(`📦 Products ready: ${products.length}`);

  // ── Orders ───────────────────────────────────────────────────────────────────
  const orderCount = await Order.countDocuments();
  if (orderCount === 0) {
    const statuses = ['delivered', 'processing', 'shipped', 'pending', 'delivered'];
    for (let i = 0; i < 5; i++) {
      const cust = customers[i % customers.length];
      const prod = products[i % products.length];
      const qty = 1 + (i % 3);
      const price = prod.salePrice || prod.price;
      await Order.create({
        customer: cust._id,
        customerName: cust.name,
        customerEmail: cust.email,
        items: [{ product: prod._id, name: prod.name, sku: prod.sku, price, quantity: qty, subtotal: price * qty }],
        subtotal: price * qty,
        shipping: 9.99,
        total: price * qty + 9.99,
        status: statuses[i],
        paymentStatus: statuses[i] === 'pending' ? 'unpaid' : 'paid',
        statusHistory: [{ status: statuses[i], note: 'Seeded order', updatedBy: admin._id }]
      });
    }
    console.log('🧾 Created 5 demo orders');
  } else {
    console.log('🧾 Orders already exist, skipping');
  }

  console.log('\n🌱 Seed complete.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
