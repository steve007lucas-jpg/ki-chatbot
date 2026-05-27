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
  .catch(err => console.error("❌ MongoDB Fehler:", err));

/* =========================
   2. LEAD MODEL
========================= */
const leadSchema = new mongoose.Schema({
  message: String,
  reply: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Lead = mongoose.model("Lead", leadSchema);

/* =========================
   3. ROUTES
========================= */

app.get("/", (req, res) => {
  res.send("🚀 KI Server läuft erfolgreich");
});

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.json({ reply: "Keine Nachricht erhalten" });
  }

  try {
    /* =========================
       KI REQUEST (OPENROUTER)
    ========================= */
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
            content: "Du bist ein hilfreicher Terminassistent. Antworte kurz und klar."
          },
          {
            role: "user",
            content: userMessage
          }
        ]
      })
    });

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content ||
      "Keine Antwort von KI erhalten";

    /* =========================
       SPEICHERN IN MONGODB
    ========================= */
    await Lead.create({
      message: userMessage,
      reply: reply
    });

    /* =========================
       RESPONSE
    ========================= */
    res.json({ reply });

  } catch (error) {
    console.error(error);
    res.json({ reply: "Server Fehler" });
  }
});

/* =========================
   4. SERVER START
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server läuft auf Port " + PORT);
});
