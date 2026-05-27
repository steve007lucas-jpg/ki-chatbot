const express = require("express");
const fetch = require("node-fetch");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// 🔐 ENV Variablen (auf Render einstellen)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MONGO_URI = process.env.MONGO_URI;

// 🔌 MongoDB verbinden
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB verbunden"))
  .catch(err => console.log("❌ Mongo Fehler:", err));

// 📦 Datenbank Modell
const Lead = mongoose.model("Lead", {
  name: String,
  phone: String,
  appointment: String,
  message: String,
  createdAt: { type: Date, default: Date.now }
});

// 🧠 SYSTEM PROMPT (SEHR WICHTIG)
const SYSTEM_PROMPT = `
Du bist ein professioneller KI Terminassistent für Unternehmen.

Deine Aufgaben:
- Begrüße den Kunden freundlich
- Stelle Fragen um den Bedarf zu verstehen
- Führe gezielt zur Terminbuchung
- Frage IMMER nach:
  - Name
  - Telefonnummer
- Schlage konkrete Termine vor (z.B. morgen 14 Uhr, Freitag 10 Uhr)

Wichtig:
- Schreibe kurz, klar und professionell
- Sei verkaufsstark
- Ziel ist IMMER: Termin vereinbaren + Kontaktdaten sammeln
`;

// 🟢 Test Route
app.get("/", (req, res) => {
  res.send("🚀 Leadaro Server läuft");
});

// 💬 Chat Route
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage }
        ]
      })
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Keine Antwort";

    // 🔎 einfache Daten-Erkennung
    const phoneMatch = userMessage.match(/\+?\d[\d\s]{5,}/);
    const nameMatch = userMessage.match(/mein name ist (.+)/i);

    if (phoneMatch || nameMatch) {
      await Lead.create({
        name: nameMatch ? nameMatch[1] : "Unbekannt",
        phone: phoneMatch ? phoneMatch[0] : "Unbekannt",
        appointment: "Noch nicht festgelegt",
        message: userMessage
      });

      console.log("💾 Lead gespeichert");
    }

    res.json({ reply });

  } catch (error) {
    console.log(error);
    res.json({ reply: "❌ Server Fehler" });
  }
});

// 🌐 Port für Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🔥 Server läuft auf Port " + PORT));
