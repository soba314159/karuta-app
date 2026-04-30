const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// --- MongoDB接続設定 ---
// あなたの接続文字列を使用
const uri = "mongodb+srv://sobaji888:w2dNPlMj1A2ujHf0@cluster0.hubxmhg.mongodb.net/karuta?retryWrites=true&w=majority&ssl=true&serverSelectionTimeoutMS=5000";

mongoose.connect(uri)
  .then(() => console.log("MongoDB接続成功！"))
  .catch((err) => console.error("接続エラー:", err));

// --- モデルの定義 ---

// 1. 参加状況（日付と時間枠ごとの名前リスト）
const ParticipationSchema = new mongoose.Schema({
  date: { type: String, required: true },
  timeSlot: { type: String, required: true },
  participants: [String]
});
// 複合インデックスで検索を高速化
ParticipationSchema.index({ date: 1, timeSlot: 1 }, { unique: true });
const Participation = mongoose.models.Participation || mongoose.model("Participation", ParticipationSchema);

// 2. メモ・部屋情報
const NoteSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  room: { type: String, default: "" },
  text: { type: String, default: "" }
});
const Note = mongoose.models.Note || mongoose.model("Note", NoteSchema);

// --- 静的ファイル配信 ---
app.use(express.static(path.join(__dirname, "public")));

// --- APIエンドポイント ---

// 参加者取得
app.get('/api/participants', async (req, res) => {
  const { date, timeSlot } = req.query;
  try {
    const record = await Participation.findOne({ date, timeSlot });
    res.json({ participants: record ? record.participants : [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 参加・取消（トグル処理）
app.post('/api/participate', async (req, res) => {
  const { date, timeSlot, userName } = req.body;
  try {
    let record = await Participation.findOne({ date, timeSlot });
    if (!record) {
      record = new Participation({ date, timeSlot, participants: [] });
    }

    const index = record.participants.indexOf(userName);
    if (index > -1) {
      record.participants.splice(index, 1); // すでにいれば削除
    } else {
      record.participants.push(userName);   // いなければ追加
    }

    await record.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// メモ取得（月単位）
app.get('/api/notes-by-month', async (req, res) => {
  const { year, month } = req.query;
  try {
    // 前方一致で指定年月のデータを検索 (例: "2026-4-")
    const regex = new RegExp(`^${year}-${month}-`);
    const notes = await Note.find({ date: { $regex: regex } });
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// メモ・部屋情報の保存
app.post('/api/notes', async (req, res) => {
  const { date, room, text } = req.body;
  try {
    const note = await Note.findOneAndUpdate(
      { date },
      { room, text },
      { new: true, upsert: true } // なければ作成、あれば更新
    );
    res.json({ success: true, note });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ポート設定
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
