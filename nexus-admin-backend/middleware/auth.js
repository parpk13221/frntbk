const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Must match the fallback used when signing tokens in routes/auth.js
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// ─── Verify JWT ─────────────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized — no token' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

// ─── Role Guard ─────────────────────────────────────────────────────────────
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.user.role}' is not permitted to access this resource`
    });
  }
  next();
};

// ─── Permission Guard ────────────────────────────────────────────────────────
const hasPermission = (permission) => (req, res, next) => {
  if (req.user.role === 'super_admin') return next();
  if (!req.user.permissions?.includes(permission)) {
    return res.status(403).json({
      success: false,
      message: `Missing permission: ${permission}`
    });
  }
  next();
};

module.exports = { protect, authorize, hasPermission };
