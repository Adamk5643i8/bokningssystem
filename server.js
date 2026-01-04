 const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// ===== DB =====
const db = new sqlite3.Database("./database.sqlite", (err) => {
  if (err) console.error(err.message);
  else console.log("Ansluten till SQLite.");
});

db.run(
  `CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName TEXT,
    lastName TEXT,
    personnummer TEXT,
    destination TEXT,
    date TEXT,
    people INTEGER,
    email TEXT
  )`,
  (err) => {
    if (err) console.log(err.message);
    else console.log("Tabellen bookings redo.");
  }
);

// ===== MAIL =====
let transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

transporter.verify()
  .then(() => console.log("Mail: SMTP redo "))
  .catch((e) => {
    console.log("Mail: SMTP fel ", e.message);
    transporter = null;
  });

async function sendMailSafe(options) {
  if (!transporter) return;
  try {
    await transporter.sendMail(options);
  } catch (e) {
    console.log("Mail-fel:", e.message);
  }
}

// ===== API =====
app.get("/api/bookings", (req, res) => {
  db.all("SELECT * FROM bookings ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/bookings", (req, res) => {
  const { firstName, lastName, personnummer, destination, date, people, email } = req.body;

  // 4 siffror
  if (!/^\d{4}$/.test(personnummer)) {
    return res.status(400).json({ error: "Personnummer måste vara 4 siffror!" });
  }

  // email
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: "Skriv in en giltig e-post!" });
  }

  // endast 2026
  const chosen = new Date(date);
  if (isNaN(chosen.getTime()) || chosen.getFullYear() !== 2026) {
    return res.status(400).json({ error: "Du kan bara boka datum under år 2026." });
  }

  // 1–7 personer
  const peopleNum = Number(people);
  if (!Number.isInteger(peopleNum) || peopleNum < 1 || peopleNum > 7) {
    return res.status(400).json({ error: "Antal personer måste vara mellan 1 och 7." });
  }

  // dubbelbokning per personnummer
  db.get("SELECT id FROM bookings WHERE personnummer = ?", [personnummer], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) return res.status(400).json({ error: "Dubbelbokning ej tillåten för detta personnummer!" });

    db.run(
      `INSERT INTO bookings (firstName,lastName,personnummer,destination,date,people,email)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [firstName, lastName, personnummer, destination, date, peopleNum, email],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.json({ id: this.lastID });

        sendMailSafe({
          from: process.env.MAIL_FROM || process.env.MAIL_USER,
          to: email,
          subject: "Bokningsbekräftelse – Urbansas Bussresor",
          text:
            `Hej ${firstName}!\n\n` +
            `Din bokning är genomförd.\n\n` +
            `Destination: ${destination}\n` +
            `Datum: ${date}\n` +
            `Antal personer: ${peopleNum}\n\n` +
            `Urbansas Bussresor`,
        });
      }
    );
  });
});

app.delete("/api/bookings/:id", (req, res) => {
  const { id } = req.params;

  db.get("SELECT * FROM bookings WHERE id = ?", [id], (err, booking) => {
    if (err) return res.status(500).json({ error: err.message });

    db.run("DELETE FROM bookings WHERE id = ?", [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.json({ deleted: this.changes });

      if (booking?.email) {
        sendMailSafe({
          from: process.env.MAIL_FROM || process.env.MAIL_USER,
          to: booking.email,
          subject: "Avbokning – Urbansas Bussresor",
          text:
            `Hej ${booking.firstName}!\n\n` +
            `Din bokning har tagits bort.\n\n` +
            `Destination: ${booking.destination}\n` +
            `Datum: ${booking.date}\n` +
            `Antal personer: ${booking.people}\n\n` +
            `Urbansas Bussresor`,
        });
      }
    });
  });
});

app.listen(3000, () => console.log("Server körs på http://localhost:3000"));
