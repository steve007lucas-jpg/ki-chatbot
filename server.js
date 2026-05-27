require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

/* =========================
   1. MONGODB VERBINDUNG
========================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB verbunden"))
  .catch(err => console.log("❌ DB Fehler:", err));

/* =========================
   2. LEAD MODEL
========================= */
const leadSchema = new mongoose.Schema({
  message: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Lead = mongoose.model("Lead", leadSchema);

/* =========================
   3. CHAT ENDPOINT
========================= */
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  try {
    // KI Anfrage
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Du bist ein freundlicher Terminassistent. Versuche Name und Telefonnummer zu erkennen."
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

    // 🔥 SPEICHERN IN DATENBANK
    await Lead.create({
      message: userMessage
    });

    res.json({ reply });

  } catch (error) {
    console.error(error);
    res.json({ reply: "Server Fehler" });
  }
});

/* =========================
   4. SERVER STARTEN
========================= */
app.listen(3000, () => {
  console.log("🚀 Server läuft auf http://localhost:3000");
});