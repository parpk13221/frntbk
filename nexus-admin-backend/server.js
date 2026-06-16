require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// ─── Socket.IO (real-time inventory + order alerts) ────────────────────────
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', methods: ['GET', 'POST'] }
});
app.set('io', io);
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// ─── Middleware ─────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api/', limiter);

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/products',   require('./routes/products'));
app.use('/api/homepage',   require('./routes/homepage'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/customers',  require('./routes/customers'));
app.use('/api/inventory',  require('./routes/inventory'));
app.use('/api/media',      require('./routes/media'));
app.use('/api/analytics',  require('./routes/analytics'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/settings',   require('./routes/settings'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ─── Error Handler ──────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ─── Database + Start ───────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexus-admin').then(() => {
  console.log('✅ MongoDB connected');
  server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});
