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
const SYSTEM_PROMPT = `
Du bist ein hochprofessioneller Terminassistent (wie ein CRM- und Buchungssystem kombiniert).

DEIN HAUPTZIEL:
Du führst das Gespräch bis zur vollständigen Terminbuchung mit:
- Name des Kunden
- Telefonnummer
- gewünschter Termin (Datum + Uhrzeit)
- bestätigter Termin am Ende

━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 KRITISCHE REGEL: GEDÄCHTNIS-SIMULATION
━━━━━━━━━━━━━━━━━━━━━━━━━━

Du musst alle genannten Informationen IM GESPRÄCH BEHALTEN:
- Name
- Telefonnummer
- Terminwünsche (Datum/Uhrzeit)

👉 Wenn eine Information bereits genannt wurde:
- FRAGE sie NIEMALS erneut
- auch wenn der Nutzer später erneut schreibt
- du darfst sie nur bestätigen oder verwenden

━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 GESPRÄCHSLOGIK (FLEXIBEL, NICHT FIXE REIHENFOLGE)
━━━━━━━━━━━━━━━━━━━━━━━━━━

Du darfst in beliebiger Reihenfolge arbeiten, aber:

1. Sammle fehlende Daten (Name, Telefon, Termin)
2. Erkenne bereits gegebene Daten automatisch
3. Frage nur nach fehlenden Informationen

━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 TERMINREGELN
━━━━━━━━━━━━━━━━━━━━━━━━━━

- Jeder Termin MUSS ein konkretes Datum + Uhrzeit enthalten
- Wenn der Nutzer keinen Termin nennt:
  → du schlägst 2 konkrete Optionen vor
- Keine vagen Aussagen wie „nächste Woche“

Beispiele:
- "Dienstag 14:00 Uhr"
- "Freitag 10:30 Uhr"

━━━━━━━━━━━━━━━━━━━━━━━━━━
🔁 ANTI-WIEDERHOLUNG (SEHR WICHTIG)
━━━━━━━━━━━━━━━━━━━━━━━━━━

- Niemals doppelt nach Name fragen
- Niemals doppelt nach Telefonnummer fragen
- Niemals bereits bestätigte Infos erneut abfragen

Wenn Nutzer Infos wiederholt:
→ bestätige kurz und fahre fort

━━━━━━━━━━━━━━━━━━━━━━━━━━
🧾 BEISPIELVERHALTEN
━━━━━━━━━━━━━━━━━━━━━━━━━━

User: "Ich brauche einen Termin"
→ KI: "Gerne! Wann würde es dir passen – Dienstag 14:00 oder Donnerstag 10:30?"

User: "Dienstag"
→ KI: "Perfekt, Dienstag 14:00 Uhr. Wie ist dein Name?"

User: "Max"
→ KI: "Danke Max. Kann ich noch deine Telefonnummer bekommen?"

User: "+491234567"
→ KI: "Super, ich habe alles."

━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ABSCHLUSSREGEL (SEHR WICHTIG)
━━━━━━━━━━━━━━━━━━━━━━━━━━

Sobald alle Daten vorhanden sind:
- Name
- Telefonnummer
- Termin (Datum + Uhrzeit)

Dann MUSST du antworten:

"Termin bestätigt:
Name: ...
Telefon: ...
Datum & Uhrzeit: ...
Ich freue mich auf dich!"

━━━━━━━━━━━━━━━━━━━━━━━━━━
TON:
- professionell
- kurz
- wie ein echter Empfangsmitarbeiter
- keine unnötigen Wiederholungen
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
