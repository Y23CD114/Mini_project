require("dotenv").config();

const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const cors = require("cors");
const Groq = require("groq-sdk");

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

/* =========================
   FILE UPLOAD CONFIG
========================= */
const upload = multer({ dest: "uploads/" });

/* =========================
   SAFE JSON PARSER
========================= */
function safeJSONParse(rawText) {
  try {
    const match = rawText.match(/(\[.*\]|\{.*\})/s);
    if (!match) throw new Error("No JSON found in AI response");
    return JSON.parse(match[0]);
  } catch (err) {
    console.error("❌ JSON PARSE FAILED");
    console.error("RAW AI RESPONSE:\n", rawText);
    throw err;
  }
}

/* =========================
   TEST ROUTE
========================= */
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

/* =========================
   AI FLASHCARD GENERATOR
========================= */
async function generateFlashcardsAI(text) {
  const prompt = `
Generate exactly 5 flashcards from the text below.

Return ONLY valid JSON:
[
  {"question": "...", "answer": "..."}
]

TEXT:
${text.slice(0, 5000)}
`;

  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3
  });

  return safeJSONParse(response.choices[0].message.content);
}

/* =========================
   UPLOAD PDF
========================= */
app.post("/upload-pdf", upload.single("pdf"), async (req, res) => {
  try {
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);
    const extractedText = pdfData.text;

    const flashcards = await generateFlashcardsAI(extractedText);

    res.json({
      success: true,
      flashcards,
      fullText: extractedText
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "PDF processing failed" });
  }
});

/* =========================
   MORE FLASHCARDS
========================= */
app.post("/more-flashcards", async (req, res) => {
  try {
    const { text, existingFlashcards = [] } = req.body;

    const prompt = `
Already generated flashcards:
${JSON.stringify(existingFlashcards)}

Generate 5 MORE flashcards.
Do NOT repeat questions.

Return ONLY valid JSON:
[
  {"question": "...", "answer": "..."}
]

TEXT:
${text.slice(0, 5000)}
`;

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4
    });

    res.json({
      success: true,
      flashcards: safeJSONParse(response.choices[0].message.content)
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "More flashcards failed" });
  }
});

/* =========================
   AI QUIZ GENERATOR
========================= */
app.post("/generate-quiz", async (req, res) => {
  try {
    const { text, count = 5 } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Missing text" });
    }

    const requestedCount = Math.min(Math.max(Number(count), 1), 25);

    const prompt = `
Generate up to ${requestedCount} multiple-choice questions.

Rules:
- 4 meaningful options
- correctAnswer must be "A", "B", "C", or "D"
- Do NOT repeat questions
- Return ONLY valid JSON

[
  {
    "question": "Question text",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "correctAnswer": "B"
  }
]

TEXT:
${text.slice(0, 6500)}
`;

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3
    });

    const quiz = safeJSONParse(response.choices[0].message.content);

    res.json({
      success: true,
      requested: requestedCount,
      generated: quiz.length,
      quiz
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Quiz generation failed" });
  }
});

/* =========================
   MORE QUIZ
========================= */
app.post("/more-quiz", async (req, res) => {
  try {
    const { text, existingQuestions = [] } = req.body;

    const prompt = `
Already generated questions:
${JSON.stringify(existingQuestions)}

Generate up to 5 MORE questions.
Do NOT repeat questions.

Return ONLY valid JSON:
[
  {
    "question": "Question text",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "correctAnswer": "C"
  }
]

TEXT:
${text.slice(0, 6500)}
`;

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4
    });

    const quiz = safeJSONParse(response.choices[0].message.content);

    res.json({
      success: true,
      generated: quiz.length,
      quiz
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "More quiz generation failed" });
  }
});

/* =========================
   AI CHAT ASSISTANT  🧠✨ (SMART VERSION)
========================= */
app.post("/chat", async (req, res) => {
  try {
    const { text = "", message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Missing message" });
    }

    const lowerMsg = message.toLowerCase().trim();

    // 🔥 Smart greeting detection
    const greetings = ["hi", "hello", "hey", "good morning", "good evening"];

    if (greetings.includes(lowerMsg)) {
      return res.json({
        success: true,
        reply: "Hey 👋 I'm your AI Study Assistant. Ask me anything about your notes!"
      });
    }

    // If no notes uploaded
    if (!text) {
      return res.json({
        success: true,
        reply: "You haven't uploaded any notes yet 📄. Upload a PDF and I'll help you study!"
      });
    }

    const prompt = `
You are a friendly AI study assistant.

If the question is related to the notes, answer clearly using them.
If it's general conversation, respond naturally and briefly.

STUDY MATERIAL:
${text.slice(0, 6000)}

USER QUESTION:
${message}
`;

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4
    });

    res.json({
      success: true,
      reply: response.choices[0].message.content
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Chat failed" });
  }
});

/* =========================
   START SERVER
========================= */
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
