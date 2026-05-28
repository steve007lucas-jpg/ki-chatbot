const express = require("express");
const mongoose = require("mongoose");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// 🔑 ENV VARS
const MONGO_URI = process.env.MONGO_URI;
const API_KEY = process.env.OPENROUTER_API_KEY;

// 🧠 MongoDB verbinden
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB verbunden"))
  .catch(err => console.log("Mongo Fehler:", err));

// 📦 SESSION MEMORY
const Session = mongoose.model("Session", {
  sessionId: String,
  name: String,
  phone: String,
  appointment: String
});

// 📅 KALENDER DATENBANK
const Appointment = mongoose.model("Appointment", {
  name: String,
  phone: String,
  date: String,
  time: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 🤖 CHAT ROUTE
app.post("/chat", async (req, res) => {
  const { message, sessionId } = req.body;

  try {
    // 🧠 Session laden / erstellen
    let session = await Session.findOne({ sessionId });

    if (!session) {
      session = await Session.create({
        sessionId,
        name: "",
        phone: "",
        appointment: ""
      });
    }

    // 🧠 Kontext für KI
    const context = `
Bekannte Daten:
Name: ${session.name || "nicht vorhanden"}
Telefon: ${session.phone || "nicht vorhanden"}
Termin: ${session.appointment || "nicht vorhanden"}
`;

    // 🤖 KI Anfrage
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `
Du bist ein professioneller Terminassistent.
Frage niemals doppelt nach Name oder Telefonnummer.
Sammle alle Daten und bestätige am Ende den Termin.

${context}
`
          },
          {
            role: "user",
            content: message
          }
        ]
      })
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Keine Antwort";

    // 🧠 DATEN ERKENNEN

    // Name erkennen
    if (
      message.toLowerCase().includes("ich bin") ||
      message.toLowerCase().includes("mein name ist")
    ) {
      session.name = message;
    }

    // Telefonnummer erkennen
    if (message.match(/\+?\d{7,}/)) {
      session.phone = message;
    }

    // Termin erkennen
    if (
      message.toLowerCase().includes("uhr") ||
      message.toLowerCase().includes("morgen") ||
      message.toLowerCase().includes("montag") ||
      message.toLowerCase().includes("dienstag") ||
      message.toLowerCase().includes("mittwoch") ||
      message.toLowerCase().includes("donnerstag") ||
      message.toLowerCase().includes("freitag")
    ) {
      session.appointment = message;
    }

    await session.save();

    // 📅 TERMIN SPEICHERN (wenn alles vorhanden)
    if (session.name && session.phone && session.appointment) {
      await Appointment.create({
        name: session.name,
        phone: session.phone,
        date: session.appointment,
        time: "noch nicht getrennt"
      });
    }

    res.json({ reply });

  } catch (err) {
    console.log(err);
    res.json({ reply: "Fehler beim Server" });
  }
});

// 📅 ALLE TERMINE ANZEIGEN
app.get("/appointments", async (req, res) => {
  try {
    const data = await Appointment.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.json([]);
  }
});

// 📅 TERMIN MANUELL SPEICHERN
app.post("/save-appointment", async (req, res) => {
  const { name, phone, date, time } = req.body;

  try {
    const newAppointment = await Appointment.create({
      name,
      phone,
      date,
      time
    });

    res.json({ success: true, appointment: newAppointment });
  } catch (err) {
    res.json({ success: false });
  }
});

// 🚀 SERVER START
app.listen(3000, () => {
  console.log("Server läuft auf Port 3000");
});
