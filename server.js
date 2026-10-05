const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// --- MongoDB接続設定 ---
const uri = "mongodb+srv://sobaji888:w2dNPlMj1A2ujHf0@cluster0.hubxmhg.mongodb.net/karuta?retryWrites=true&w=majority&ssl=true&serverSelectionTimeoutMS=5000";

mongoose.connect(uri)
  .then(() => console.log("MongoDB接続成功！"))
  .catch((err) => console.error("接続エラー:", err));

// --- モデルの定義 ---

// 1. 参加状況（日付・時間枠ごとの参加者リスト）
const ParticipationSchema = new mongoose.Schema({
  date: { type: String, required: true },
  timeSlot: { type: String, required: true },
  participants: [String]
});
// 検索を速くし、重複を防ぐ設定
ParticipationSchema.index({ date: 1, timeSlot: 1 }, { unique: true });
const Participation = mongoose.models.Participation || mongoose.model("Participation", ParticipationSchema);

// 2. メモ・部屋情報
const NoteSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  room: { type: String, default: "" },
  text: { type: String, default: "" },
  color: { type: String, default: "#ffffff" }
});
const Note = mongoose.models.Note || mongoose.model("Note", NoteSchema);

// 3. メンバー情報（名前ごとの段位・プレート装飾）
const RANKS = ["", "A", "B", "C", "D", "E"];
const FLAIRS = ["", "gold", "rainbow", "glitch", "sakura", "sumi"];
const MemberSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  rank: { type: String, enum: RANKS, default: "" },
  flair: { type: String, enum: FLAIRS, default: "" },
  icon: { type: String, default: "" },
  frame: { type: String, default: "" }
});
const Member = mongoose.models.Member || mongoose.model("Member", MemberSchema);

// 部屋が設定されている日の参加回数（1枠＝1回）で解放されるアイコンとプレート枠
const UNLOCKS = {
  icons: [
    { id: "🌱", need: 1 }, { id: "🍵", need: 3 }, { id: "🌸", need: 5 }, { id: "🎴", need: 10 },
    { id: "🍁", need: 15 }, { id: "🔥", need: 20 }, { id: "⚡", need: 30 }, { id: "👑", need: 50 }
  ],
  frames: [
    { id: "double", label: "二重枠", need: 3 }, { id: "gold", label: "金縁", need: 7 },
    { id: "sakura", label: "桜縁", need: 15 }, { id: "glow", label: "光彩", need: 25 },
    { id: "nishiki", label: "錦", need: 40 }
  ]
};

// 名前 → 参加回数 のMap（nameを渡すとその人だけ）
async function practiceCounts(name) {
  const roomDates = await Note.distinct("date", { room: { $nin: ["", null] } });
  const match = { date: { $in: roomDates } };
  if (name) match.participants = name;
  const pipeline = [{ $match: match }, { $unwind: "$participants" }];
  if (name) pipeline.push({ $match: { participants: name } });
  pipeline.push({ $group: { _id: "$participants", count: { $sum: 1 } } });
  const rows = await Participation.aggregate(pipeline);
  return new Map(rows.map(r => [r._id, r.count]));
}

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
    const regex = new RegExp(`^${year}-${month}-`);
    const notes = await Note.find({ date: { $regex: regex } });
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// メモ・部屋情報の保存
app.post('/api/notes', async (req, res) => {
  const { date, room, text, color } = req.body;
  try {
    const note = await Note.findOneAndUpdate(
      { date },
      { room, text, color },
      { new: true, upsert: true }
    );
    res.json({ success: true, note });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// メンバー一覧取得（段位・装飾）
app.get('/api/members', async (req, res) => {
  try {
    const [docs, counts] = await Promise.all([
      Member.find({}, { _id: 0, name: 1, rank: 1, flair: 1, icon: 1, frame: 1 }).lean(),
      practiceCounts()
    ]);
    const byName = new Map(docs.map(d => [d.name, d]));
    for (const name of counts.keys()) if (!byName.has(name)) byName.set(name, { name });
    const members = [...byName.values()].map(m => ({
      name: m.name, rank: m.rank || "", flair: m.flair || "", icon: m.icon || "", frame: m.frame || "",
      count: counts.get(m.name) || 0
    }));
    res.json({ members, unlocks: UNLOCKS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 段位・装飾の保存（送られてきた項目だけ更新）
app.post('/api/members', async (req, res) => {
  const { userName, rank, flair, icon, frame } = req.body;
  if (typeof userName !== "string" || !userName.trim()) {
    return res.status(400).json({ success: false, error: "userNameが必要です" });
  }
  const update = {};
  if (rank !== undefined) {
    if (!RANKS.includes(rank)) return res.status(400).json({ success: false, error: "段位が不正です" });
    update.rank = rank;
  }
  if (flair !== undefined) {
    if (!FLAIRS.includes(flair)) return res.status(400).json({ success: false, error: "装飾が不正です" });
    update.flair = flair;
  }
  try {
    const name = userName.trim();
    const count = (await practiceCounts(name)).get(name) || 0;
    // アイコン・枠は参加回数が足りているものだけ装備できる（""は外す）
    for (const [key, value, list] of [["icon", icon, UNLOCKS.icons], ["frame", frame, UNLOCKS.frames]]) {
      if (value === undefined) continue;
      const item = list.find(u => u.id === value);
      if (value !== "" && !item) return res.status(400).json({ success: false, error: "指定が不正です" });
      if (item && count < item.need) return res.status(403).json({ success: false, error: "まだ解放されていません" });
      update[key] = value;
    }
    const member = await Member.findOneAndUpdate(
      { name },
      { $set: update },
      { new: true, upsert: true }
    );
    res.json({ success: true, member: {
      name: member.name, rank: member.rank, flair: member.flair,
      icon: member.icon || "", frame: member.frame || "", count
    } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ポート設定（Render用）
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
