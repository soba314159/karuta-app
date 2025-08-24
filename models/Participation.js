const mongoose = require("mongoose");

const participationSchema = new mongoose.Schema({
  date: { type: String, required: true }, // 例: "2025-8-15"
  timeSlot: { type: String, required: true }, // 例: "9:00-10:30"
  participants: { type: [String], default: [] }, // 参加者名の配列
});

module.exports = mongoose.model("Participation", participationSchema);
