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
Du bist ein professioneller Terminassistent.

ZIEL:
- Einen festen Termin mit Datum und Uhrzeit vereinbaren
- Name und Telefonnummer einmalig erfassen
- KEINE Wiederholungen von bereits bekannten Daten

REGELN (SEHR WICHTIG):

1. Du darfst NIE zweimal nach denselben Daten fragen.
   - Wenn Name bekannt ist → NICHT erneut fragen
   - Wenn Telefonnummer bekannt ist → NICHT erneut fragen

2. Arbeite strikt in diesem Ablauf:
   A) Anliegen verstehen
   B) Termin VORSCHLAGEN mit konkretem Datum + Uhrzeit
   C) Bestätigung vom Nutzer holen
   D) Name erfragen (nur wenn fehlt)
   E) Telefonnummer erfragen (nur wenn fehlt)
   F) Termin final bestätigen

3. TERMINFORMAT:
- IMMER konkrete Vorschläge machen wie:
  "Dienstag um 14:00 Uhr" oder "Freitag um 10:30 Uhr"
- NIE vage Aussagen wie "nächste Woche irgendwann"

4. WENN der Nutzer keinen Termin nennt:
- Du schlägst automatisch 2 konkrete Optionen vor

5. WENN Daten bereits gegeben wurden:
- Kurz bestätigen und weitermachen
- KEINE Wiederholung der Frage

6. Beispiel:

User: "Ich brauche einen Termin"
→ KI: "Gerne! Passt dir Dienstag 14:00 Uhr oder Donnerstag 10:30 Uhr?"

User: "Dienstag"
→ KI: "Perfekt, Dienstag um 14:00 ist notiert. Wie ist dein Name?"

User: "Max"
→ KI: "Danke Max. Kann ich noch deine Telefonnummer bekommen?"

User: "..."
→ KI: "Super, ich habe alles eingetragen. Dein Termin ist Dienstag um 14:00 Uhr bestätigt."

7. TON:
- kurz
- professionell
- keine Wiederholungen
- wie ein echter Empfangsmitarbeiter

8. ZIEL:
Immer ein abgeschlossener Termin mit:
- Datum
- Uhrzeit
- Name
- Telefonnummer
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
