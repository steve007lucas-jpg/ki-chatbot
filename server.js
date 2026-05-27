const express = require("express");
const fetch = require("node-fetch");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// 🔥 HIER EINTRAGEN
const OPENROUTER_API_KEY = "DEIN_API_KEY";
const MONGO_URI = "DEINE_MONGODB_VERBINDUNG";

// MongoDB verbinden
mongoose.connect(MONGO_URI);

const Lead = mongoose.model("Lead", {
  name: String,
  phone: String,
  message: String,
  date: { type: Date, default: Date.now }
});

// Chat Route
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
          {
            role: "system",
            content: `
Du bist ein professioneller Terminassistent.

Deine Aufgaben:
- Beantworte Kunden freundlich
- Führe zur Terminbuchung
- Frage nach Name und Telefonnummer
- Schlage Termine vor

Ziel:
Lead generieren und Termin vereinbaren.
`
          },
          {
            role: "user",
            content: userMessage
          }
        ]
      })
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Keine Antwort";

    // 🔥 einfache Lead-Erkennung
    if (userMessage.toLowerCase().includes("mein name") || userMessage.match(/\d{5,}/)) {
      await Lead.create({
        name: userMessage,
        phone: userMessage,
        message: userMessage
      });
    }

    res.json({ reply });

  } catch (err) {
    res.json({ reply: "Server Fehler" });
  }
});

app.listen(3000, () => console.log("Server läuft"));
