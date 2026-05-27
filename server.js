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
  .catch(err => console.error("❌ DB Fehler:", err));

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

  if (!userMessage) {
    return res.json({ reply: "Keine Nachricht erhalten." });
  }

  try {
    // KI REQUEST
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
            content: "Du bist ein freundlicher Terminassistent. Frage bei Bedarf nach Name und Telefonnummer."
          },
          {
            role: "user",
            content: userMessage
          }
        ]
      })
    });

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || "Keine Antwort";

    // 🔥 LEAD SPEICHERN
    await Lead.create({
      message: userMessage
    });

    res.json({ reply });

  } catch (error) {
    console.error("Fehler:", error);
    res.json({ reply: "Server Fehler" });
  }
});

/* =========================
   4. SERVER START
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
});
