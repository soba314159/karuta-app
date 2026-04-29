const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// データを保存する変数
let participantsData = {}; // { "2026-4-29": { "9:00～10:30": ["名前1", "名前2"] } }
let notesData = {};        // { "2026-4-29": { room: "和室A", text: "連絡事項" } }

// 参加者取得
app.get('/api/participants', (req, res) => {
    const { date, timeSlot } = req.query;
    const participants = (participantsData[date] && participantsData[date][timeSlot]) || [];
    res.json({ participants });
});

// 参加・取消
app.post('/api/participate', (req, res) => {
    const { date, timeSlot, userName } = req.body;
    if (!participantsData[date]) participantsData[date] = {};
    if (!participantsData[date][timeSlot]) participantsData[date][timeSlot] = [];
    
    const index = participantsData[date][timeSlot].indexOf(userName);
    if (index > -1) {
        participantsData[date][timeSlot].splice(index, 1);
    } else {
        participantsData[date][timeSlot].push(userName);
    }
    res.json({ success: true });
});

// メモ取得（月単位）
app.get('/api/notes-by-month', (req, res) => {
    const { year, month } = req.query;
    const notes = Object.keys(notesData)
        .filter(date => date.startsWith(`${year}-${month}-`))
        .map(date => ({ date, ...notesData[date] }));
    res.json({ notes });
});

// メモ保存
app.post('/api/notes', (req, res) => {
    const { date, room, text } = req.body;
    notesData[date] = { room, text };
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
