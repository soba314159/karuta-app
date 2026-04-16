const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

// MongoDB接続URI
const uri =
  "mongodb+srv://sobaji888:w2dNPlMj1A2ujHf0@cluster0.hubxmhg.mongodb.net/karuta?retryWrites=true&w=majority&ssl=true&serverSelectionTimeoutMS=5000";

// MongoDB接続
mongoose
  .connect(uri)
  .then(() => {
    console.log("MongoDB接続成功！");
    app.listen(port, () => {
      console.log(`サーバーがポート${port}で起動しました`);
    });
  })
  .catch((err) => {
    console.error("接続エラー:", err);
  });

// --- モデルの定義 ---

// 1. 参加状況モデル
const Participation = require("./models/Participation");

// 2. カレンダー備考・和室予約モデル
const NoteSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  color: { type: String, default: "#ffffff" },
  text: { type: String, default: "" },
  room: { type: String, default: "none" },
});
const Note = mongoose.models.Note || mongoose.model("Note", NoteSchema);

// 3. 和歌モデル (重複定義エラー回避のため models.Waka を確認)
const WakaSchema = new mongoose.Schema({
  text: { type: String, required: true },
  author: { type: String, default: "匿名" },
  userId: { type: String, required: true }, // 投稿者識別用
  likes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});
const Waka = mongoose.models.Waka || mongoose.model("Waka", WakaSchema);

// --- 静的ファイル配信 ---
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --- APIエンドポイント ---

// 【参加管理API】
app.get("/api/participants", async (req, res) => {
  const { date, timeSlot } = req.query;
  if (!date || !timeSlot)
    return res.status(400).json({ error: "dateとtimeSlotを指定してください" });
  try {
    const record = await Participation.findOne({ date, timeSlot });
    res.json({ participants: record ? record.participants : [] });
  } catch (err) {
    res.status(500).json({ error: "サーバーエラー" });
  }
});

app.post("/api/participate", async (req, res) => {
  const { date, timeSlot, userName } = req.body;
  if (!date || !timeSlot || !userName)
    return res.status(400).json({ error: "不足項目があります" });
  try {
    let record = await Participation.findOne({ date, timeSlot });
    if (!record)
      record = new Participation({ date, timeSlot, participants: [] });

    const index = record.participants.indexOf(userName);
    if (index > -1) record.participants.splice(index, 1);
    else record.participants.push(userName);

    await record.save();
    res.json({ success: true, participants: record.participants });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 【カレンダー備考・和室API】
app.post("/api/notes", async (req, res) => {
  const { date, color, text, room } = req.body;
  try {
    const note = await Note.findOneAndUpdate(
      { date },
      { color, text, room },
      { new: true, upsert: true },
    );
    res.json({ success: true, note });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/notes-by-month", async (req, res) => {
  const { year, month } = req.query;
  try {
    const regex = new RegExp(`^${year}-${month}-`);
    const notes = await Note.find({ date: { $regex: regex } });
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 【和歌API】
app.post("/api/waka", async (req, res) => {
  const { text, author, userId } = req.body;
  try {
    const newWaka = new Waka({ text, author: author || "匿名", userId });
    await newWaka.save();
    res.json({ success: true, waka: newWaka });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/waka/random", async (req, res) => {
  try {
    const count = await Waka.countDocuments();
    if (count === 0) return res.json({ waka: null });
    const random = Math.floor(Math.random() * count);
    const waka = await Waka.findOne().skip(random);
    res.json({ waka });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/my-waka", async (req, res) => {
  const { userId } = req.query;
  try {
    const wakas = await Waka.find({ userId }).sort({ createdAt: -1 });
    res.json({ wakas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/waka/:id/like", async (req, res) => {
  try {
    const waka = await Waka.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true },
    );
    res.json({ success: true, likes: waka.likes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/waka/:id", async (req, res) => {
  try {
    await Waka.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/waka/:id", async (req, res) => {
  const { text } = req.body;
  try {
    const updated = await Waka.findByIdAndUpdate(
      req.params.id,
      { text },
      { new: true },
    );
    res.json({ success: true, waka: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
