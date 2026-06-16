// media.js
const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

router.use(protect);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/jpg','image/png','image/webp','image/gif','video/mp4','application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not allowed'), false);
  }
});

// Upload single file
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const folder = req.body.folder || 'nexus-admin';
    const resourceType = req.file.mimetype.startsWith('video') ? 'video' : 'image';
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: resourceType, quality: 'auto', fetch_format: 'auto' },
        (err, result) => err ? reject(err) : resolve(result)
      );
      stream.end(req.file.buffer);
    });
    res.json({
      success: true,
      file: { url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height, format: result.format, size: result.bytes, resourceType }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Upload multiple files
router.post('/upload-multiple', upload.array('files', 20), async (req, res) => {
  try {
    const folder = req.body.folder || 'nexus-admin';
    const uploads = await Promise.all(req.files.map(file => new Promise((resolve, reject) => {
      const resourceType = file.mimetype.startsWith('video') ? 'video' : 'image';
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: resourceType, quality: 'auto', fetch_format: 'auto' },
        (err, result) => err ? reject(err) : resolve({ url: result.secure_url, publicId: result.public_id, format: result.format, size: result.bytes, resourceType })
      );
      stream.end(file.buffer);
    })));
    res.json({ success: true, files: uploads });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Delete file
router.delete('/:publicId(*)', authorize('super_admin','admin'), async (req, res) => {
  try {
    await cloudinary.uploader.destroy(req.params.publicId);
    res.json({ success: true, message: 'File deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// List media from cloudinary
router.get('/library', async (req, res) => {
  try {
    const { folder = 'nexus-admin', type = 'image', next_cursor } = req.query;
    const result = await cloudinary.api.resources({
      type: 'upload', prefix: folder, resource_type: type,
      max_results: 50, next_cursor
    });
    res.json({ success: true, resources: result.resources, next_cursor: result.next_cursor });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
