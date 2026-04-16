const multer = require('multer');
const path = require('path');
const express = require('express');

// --- ファイル保存の設定 ---
const storage = multer.diskStorage({
  destination: './uploads/', // uploadsフォルダに保存
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// サーバー内の静的ファイルを公開する設定
app.use('/uploads', express.static('uploads'));

// --- 掲示板用スキーマの修正 ---
const bbsSchema = new mongoose.Schema({
  author: String,
  text: String,
  fileUrl: String, // ファイルのURLを保存
  createdAt: { type: Date, default: Date.now }
});
const Bbs = mongoose.model("Bbs", bbsSchema);

// --- APIルート ---

// 掲示板取得
app.get("/api/bbs", async (req, res) => {
  const posts = await Bbs.find().sort({ createdAt: 1 }).limit(50);
  res.json({ posts });
});

// 掲示板投稿 (ファイル対応)
app.post("/api/bbs", upload.single('file'), async (req, res) => {
  const { author, text } = req.body;
  const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;
  
  const newPost = new Bbs({ author, text, fileUrl });
  await newPost.save();
  res.json({ success: true });
});
