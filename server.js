const express = require("express");
const mongoose = require("mongoose");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// 🔑 ENV VARS (bei Render setzen)
const MONGO_URI = process.env.MONGO_URI;
const API_KEY = process.env.OPENROUTER_API_KEY;

// 🧠 MongoDB verbinden
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB verbunden"))
  .catch(err => console.log("Mongo Fehler:", err));

// 📦 Session (Memory)
const Session = mongoose.model("Session", {
  sessionId: String,
  name: String,
  phone: String,
  appointment: String
});

// 📅 Termine
const Appointment = mongoose.model("Appointment", {
  name: String,
  phone: String,
  date: String,
  time: String
});

// 🤖 CHAT ROUTE
app.post("/chat", async (req, res) => {
  const { message, sessionId } = req.body;

  try {
    // Session laden oder erstellen
    let session = await Session.findOne({ sessionId });

    if (!session) {
      session = await Session.create({
        sessionId,
        name: "",
        phone: "",
        appointment: ""
      });
    }

    // Kontext für KI
    const context = `
Bekannte Daten:
Name: ${session.name || "nicht vorhanden"}
Telefon: ${session.phone || "nicht vorhanden"}
Termin: ${session.appointment || "nicht vorhanden"}
`;

    // KI Anfrage
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
Du bist ein Terminassistent.
Frage niemals doppelt nach Name oder Telefonnummer.
Führe zu einem Termin mit Datum und Uhrzeit.

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

    // 🧠 DATEN ERKENNUNG (einfach)
    if (message.toLowerCase().includes("ich bin") || message.toLowerCase().includes("mein name")) {
      session.name = message;
    }

    if (message.match(/\+?\d{7,}/)) {
      session.phone = message;
    }

    if (message.toLowerCase().includes("uhr") || message.toLowerCase().includes("morgen") || message.toLowerCase().includes("montag")) {
      session.appointment = message;
    }

    await session.save();

    // 📅 Termin speichern wenn alles da ist
    if (session.name && session.phone && session.appointment) {

      // einfache Trennung (später verbesserbar)
      const date = session.appointment;
      const time = "nicht gesetzt";

      await Appointment.create({
        name: session.name,
        phone: session.phone,
        date,
        time
      });
    }

    res.json({ reply });

  } catch (err) {
    console.log(err);
    res.json({ reply: "Fehler beim Server" });
  }
});

// 📅 ALLE TERMINE ABRUFEN
app.get("/appointments", async (req, res) => {
  const data = await Appointment.find();
  res.json(data);
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
