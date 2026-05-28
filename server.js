const express = require("express");
const mongoose = require("mongoose");
const fetch = require("node-fetch");
const { google } = require("googleapis");

const app = express();
app.use(express.json());

// 🔑 ENV VARS (bei Render setzen!)
const MONGO_URI = process.env.MONGO_URI;
const API_KEY = process.env.OPENROUTER_API_KEY;

// 🧠 MongoDB verbinden
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB verbunden"))
  .catch(err => console.log("Mongo Fehler:", err));

// 📦 Session Schema (Memory)
const Session = mongoose.model("Session", {
  sessionId: String,
  name: String,
  phone: String,
  appointment: String
});

// 📅 Google Calendar Setup
const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json", // kommt gleich
  scopes: ["https://www.googleapis.com/auth/calendar"]
});

const calendar = google.calendar({ version: "v3", auth });

// 📅 Termin erstellen
async function createEvent(session) {
  await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: "Neuer Termin",
      description: `Name: ${session.name}, Tel: ${session.phone}`,
      start: {
        dateTime: session.appointment,
        timeZone: "Europe/Berlin"
      },
      end: {
        dateTime: session.appointment,
        timeZone: "Europe/Berlin"
      }
    }
  });
}

// 🤖 CHAT ROUTE
app.post("/chat", async (req, res) => {
  const { message, sessionId } = req.body;

  try {
    // 🧠 Session laden oder neu erstellen
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
Du bist ein Terminassistent.
Frage NIEMALS doppelt nach Name oder Telefonnummer.
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
    const reply = data.choices?.[0]?.message?.content;

    // 🧠 DATEN ERKENNEN (EINFACH)
    if (message.toLowerCase().includes("name")) {
      session.name = message;
    }

    if (message.match(/\+?\d{7,}/)) {
      session.phone = message;
    }

    if (message.toLowerCase().includes("uhr") || message.toLowerCase().includes("morgen")) {
      session.appointment = new Date().toISOString(); // später verbessern
    }

    await session.save();

    // 📅 Wenn alles da → Termin erstellen
    if (session.name && session.phone && session.appointment) {
      await createEvent(session);
    }

    res.json({ reply });

  } catch (err) {
    console.log(err);
    res.json({ reply: "Fehler beim Server" });
  }
});

app.listen(3000, () => console.log("Server läuft"));
