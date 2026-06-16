// ─── routes/auth.js ──────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || `${JWT_SECRET}_refresh`;
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '30d';

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRE });

const signRefreshToken = (user) =>
  jwt.sign({ id: user._id, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRE });

const sanitize = (user) => {
  const obj = user.toObject ? user.toObject() : user;
  delete obj.password;
  return obj;
};

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    user.lastLogin = new Date();
    user.loginHistory.push({
      ip: req.ip,
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date()
    });
    if (user.loginHistory.length > 20) user.loginHistory = user.loginHistory.slice(-20);
    await user.save();

    res.json({ success: true, token: signToken(user), refreshToken: signRefreshToken(user), user: sanitize(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/auth/setup ────────────────────────────────────────────────────
// Bootstraps the very first super_admin when no users exist yet.
router.post('/setup', async (req, res) => {
  try {
    const count = await User.countDocuments();
    if (count > 0) {
      return res.status(403).json({ success: false, message: 'Setup already completed' });
    }
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }
    const user = await User.create({
      name, email: email.toLowerCase(), password, role: 'super_admin', isActive: true
    });
    res.status(201).json({ success: true, token: signToken(user), refreshToken: signRefreshToken(user), user: sanitize(user) });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Email already in use' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/auth/register ─────────────────────────────────────────────────
// Create a staff user. Only super_admin / admin may invite new team members.
router.post('/register', protect, async (req, res) => {
  try {
    if (!['super_admin', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not permitted to create users' });
    }
    const { name, email, password, role = 'editor', permissions = [] } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }
    // Only super_admin can mint another super_admin
    const safeRole = role === 'super_admin' && req.user.role !== 'super_admin' ? 'admin' : role;
    const user = await User.create({
      name, email: email.toLowerCase(), password, role: safeRole, permissions
    });
    res.status(201).json({ success: true, user: sanitize(user) });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Email already in use' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────
router.post('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/auth/refresh ──────────────────────────────────────────────────
// Exchange a valid refresh token for a fresh access token (and rotated refresh token).
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required' });
    }
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Refresh token invalid or expired' });
    }
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ success: false, message: 'Invalid token type' });
    }
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated' });
    }
    res.json({ success: true, token: signToken(user), refreshToken: signRefreshToken(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
