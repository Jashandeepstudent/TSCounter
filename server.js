// Fully Cloudinary-powered server.js with Leave Cooldown
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');
const bodyParser = require('body-parser');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use('/', express.static(path.join(__dirname, 'public')));

// Cloudinary Config
cloudinary.config({
  cloud_name: 'dctm6ndpo',
  api_key: '812892555457649',
  api_secret: '5NxTOg76g4yCRm6OWzJyxT6_fGI'
});

const contentPath = path.join(__dirname, 'data', 'content.json');
const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };
ensureDir(path.join(__dirname, 'data'));

// Cloudinary Storage Configurations
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: { folder: 'school-images', allowed_formats: ['jpg', 'jpeg', 'png'] },
});

const videoStorage = new CloudinaryStorage({
  cloudinary,
  params: { folder: 'school-videos', resource_type: 'video', allowed_formats: ['mp4', 'mov', 'avi'] },
});

const bgStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'school-bg',
    public_id: 'background',
    overwrite: true,
    allowed_formats: ['jpg', 'jpeg', 'png']
  },
});

const uploadImages = multer({ storage: imageStorage }).array('images');
const uploadVideo = multer({ storage: videoStorage }).single('video');
const uploadBackground = multer({ storage: bgStorage }).single('background');

// Upload images to Cloudinary
app.post('/upload-image', (req, res) => {
  uploadImages(req, res, (err) => {
    if (err) return res.status(500).send({ error: err.message });
    const urls = req.files.map(file => file.path);
    let content = fs.existsSync(contentPath) ? JSON.parse(fs.readFileSync(contentPath, 'utf8')) : {};
    content.galleryImages = Array.from(new Set([...(content.galleryImages || []), ...urls]));
    fs.writeFileSync(contentPath, JSON.stringify(content, null, 2));
    res.send({ files: urls });
  });
});

// Upload video to Cloudinary
app.post('/upload-video', (req, res) => {
  uploadVideo(req, res, (err) => {
    if (err) return res.status(500).send({ error: err.message });
    const url = req.file.path;
    let content = fs.existsSync(contentPath) ? JSON.parse(fs.readFileSync(contentPath, 'utf8')) : {};
    content.galleryVideos = Array.from(new Set([...(content.galleryVideos || []), url]));
    fs.writeFileSync(contentPath, JSON.stringify(content, null, 2));
    res.send({ file: url });
  });
});

// Upload background image to Cloudinary
app.post('/upload-background', (req, res) => {
  uploadBackground(req, res, (err) => {
    if (err) return res.status(500).send({ error: err.message });
    let content = fs.existsSync(contentPath) ? JSON.parse(fs.readFileSync(contentPath, 'utf8')) : {};
    content.backgroundImage = req.file.path;
    fs.writeFileSync(contentPath, JSON.stringify(content, null, 2));
    res.send({ file: req.file.path });
  });
});

// Save home/about content
app.post('/save-content', (req, res) => {
  const { section, title, desc } = req.body;
  let content = fs.existsSync(contentPath) ? JSON.parse(fs.readFileSync(contentPath, 'utf8')) : {};
  content[section] = { title, desc };
  fs.writeFileSync(contentPath, JSON.stringify(content, null, 2));
  res.send({ message: 'Content saved.' });
});

// Submit leave (cooldown check and store)
app.post('/submit-leave', (req, res) => {
  const { name, roll } = req.body;
  if (!name || !roll) return res.status(400).send({ error: 'Missing name or roll' });
  const key = `${name}_${roll}`;
  const now = Date.now();
  let content = fs.existsSync(contentPath) ? JSON.parse(fs.readFileSync(contentPath, 'utf8')) : {};
  content.leaveRecords = content.leaveRecords || {};
  const lastSubmit = content.leaveRecords[key];
  const cooldown = 24 * 60 * 60 * 1000; // 24 hours

  if (lastSubmit && now - lastSubmit < cooldown) {
    const remaining = cooldown - (now - lastSubmit);
    return res.status(429).send({ error: 'Leave already submitted', remaining });
  }

  content.leaveRecords[key] = now;
  fs.writeFileSync(contentPath, JSON.stringify(content, null, 2));
  res.send({ message: 'Leave submitted successfully', nextAllowed: now + cooldown });
});

// Load all content
app.get('/load-content', (req, res) => {
  try {
    const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    res.send(content);
  } catch (err) {
    res.status(500).send({ error: 'Error loading content.' });
  }
});

// Delete image from Cloudinary
app.post('/delete-image', async (req, res) => {
  const { url } = req.body;
  const publicIdMatch = url.match(/school-images\/([^\.\/]+)/);
  if (!publicIdMatch) return res.status(400).send({ error: 'Invalid Cloudinary URL' });
  try {
    await cloudinary.uploader.destroy(`school-images/${publicIdMatch[1]}`);
    let content = fs.existsSync(contentPath) ? JSON.parse(fs.readFileSync(contentPath, 'utf8')) : {};
    content.galleryImages = (content.galleryImages || []).filter(img => img !== url);
    fs.writeFileSync(contentPath, JSON.stringify(content, null, 2));
    res.send({ success: true });
  } catch (err) {
    res.status(500).send({ error: 'Failed to delete Cloudinary image' });
  }
});

// Delete video from Cloudinary
app.post('/delete-video', async (req, res) => {
  const { url } = req.body;
  const publicIdMatch = url.match(/school-videos\/([^\.\/]+)/);
  if (!publicIdMatch) return res.status(400).send({ error: 'Invalid Cloudinary URL' });
  try {
    await cloudinary.uploader.destroy(`school-videos/${publicIdMatch[1]}`, { resource_type: 'video' });
    let content = fs.existsSync(contentPath) ? JSON.parse(fs.readFileSync(contentPath, 'utf8')) : {};
    content.galleryVideos = (content.galleryVideos || []).filter(vid => vid !== url);
    fs.writeFileSync(contentPath, JSON.stringify(content, null, 2));
    res.send({ success: true });
  } catch (err) {
    res.status(500).send({ error: 'Failed to delete Cloudinary video' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});