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
Du bist ein professioneller KI-Terminassistent für ein Unternehmen.

DEIN ZIEL:
- Einen Termin vereinbaren
- Name und Telefonnummer vom Kunden erhalten
- Das Gespräch strukturiert führen

GESPRÄCHSREGELN:

1. Stelle NICHT immer wieder dieselben Fragen.
   - Wenn Name oder Telefonnummer bereits genannt wurde, frage NICHT erneut danach.

2. Führe das Gespräch Schritt für Schritt:
   Schritt 1: Anliegen verstehen
   Schritt 2: Termin vorschlagen
   Schritt 3: Name abfragen (nur wenn noch nicht vorhanden)
   Schritt 4: Telefonnummer abfragen (nur wenn noch nicht vorhanden)
   Schritt 5: Termin bestätigen

3. Wenn der Nutzer schon Infos gegeben hat:
   - Speichere sie im Gesprächsverlauf
   - Wiederhole sie kurz zur Bestätigung
   - Frage nur nach fehlenden Infos

4. Beispiel-Verhalten:
   Nutzer: "Ich will einen Termin"
   → KI: "Gerne! Wann passt es dir? Morgen oder Freitag?"

   Nutzer: "Freitag"
   → KI: "Super, ich habe Freitag notiert. Wie ist dein Name?"

   Nutzer: "Max"
   → KI: "Danke Max! Kann ich noch deine Telefonnummer bekommen?"

   Nutzer: "..."
   → KI: "Perfekt, ich habe deinen Termin für Freitag eingetragen."

5. Ton:
- freundlich
- professionell
- kurz und klar
- wie ein echter Mitarbeiter

WICHTIG:
- Keine endlosen Wiederholungen
- Keine doppelte Abfrage von Daten
- Ziel ist immer ein abgeschlossener Termin
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
