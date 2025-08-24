const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");

const app = express();
const port = 3001;

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

// モデルの読み込み
const Participation = require("./models/Participation");

// Noteモデルを定義
const NoteSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  color: { type: String, default: "#ffffff" },
  text: { type: String, default: "" },
});
const Note = mongoose.model("Note", NoteSchema);

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 参加者を取得するAPI
app.get("/api/participants", async (req, res) => {
  const { date, timeSlot } = req.query;
  if (!date || !timeSlot) {
    return res.status(400).json({ error: "dateとtimeSlotを指定してください" });
  }
  try {
    const record = await Participation.findOne({ date, timeSlot });
    res.json({ participants: record ? record.participants : [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "サーバーエラー" });
  }
});

// 参加/参加取消を行うAPI
app.post("/api/participate", async (req, res) => {
  const { date, timeSlot, userName } = req.body;
  if (!date || !timeSlot || !userName) {
    return res
      .status(400)
      .json({ error: "date, timeSlot, userNameが必要です" });
  }

  try {
    let record = await Participation.findOne({ date, timeSlot });
    if (!record) {
      record = new Participation({ date, timeSlot, participants: [] });
    }
    const participantIndex = record.participants.indexOf(userName);
    if (participantIndex > -1) {
      record.participants.splice(participantIndex, 1);
    } else {
      record.participants.push(userName);
    }
    await record.save();

    res.json({ success: true, participants: record.participants });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "サーバーエラー" });
  }
});

app.get("/api/participations", async (req, res) => {
  const { date } = req.query;
  try {
    const participations = await Participation.find({ date });
    res.json(participations);
  } catch (err) {
    console.error(err);
    res.status(500).send("エラーが発生しました");
  }
});

// ノートを保存・取得するAPI
app.post("/api/notes", async (req, res) => {
  const { date, color, text } = req.body;
  try {
    const note = await Note.findOneAndUpdate(
      { date },
      { color, text },
      { new: true, upsert: true },
    );
    res.json({ success: true, note });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/notes", async (req, res) => {
  const { date } = req.query;
  try {
    const note = await Note.findOne({ date });
    res.json({ note });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 新しいAPI: 月ごとのノートをまとめて取得
app.get("/api/notes-by-month", async (req, res) => {
  const { year, month } = req.query;
  try {
    // MongoDBの検索条件
    const regex = new RegExp(`^${year}-${month}-`);
    const notes = await Note.find({ date: { $regex: regex } });
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
