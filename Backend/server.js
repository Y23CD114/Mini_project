const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   FILE UPLOAD CONFIG
========================= */
const upload = multer({
  dest: "uploads/"
});

/* =========================
   TEST ROUTE
========================= */
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

/* =========================
   PDF UPLOAD + PYTHON NLP
========================= */
app.post("/upload-pdf", upload.single("pdf"), async (req, res) => {
  try {
    // 1. Read PDF
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);
    const extractedText = pdfData.text;

    // 2. Ask Python for FIRST batch of flashcards
    const pythonResponse = await axios.post(
      "http://127.0.0.1:8000/generate",
      {
        text: extractedText,
        start: 0
      }
    );

    // 3. Send to frontend
    res.json({
      success: true,
      flashcards: pythonResponse.data.flashcards,
      nextIndex: pythonResponse.data.nextIndex,
      fullText: extractedText
    });

  } catch (error) {
    console.error("Upload error:", error.message);
    res.status(500).json({ error: "Failed to process PDF" });
  }
});

/* =========================
   LOAD MORE FLASHCARDS
========================= */
app.post("/load-more", async (req, res) => {
  try {
    const { text, start } = req.body;

    const pythonResponse = await axios.post(
      "http://127.0.0.1:8000/generate",
      {
        text,
        start
      }
    );

    res.json({
      flashcards: pythonResponse.data.flashcards,
      nextIndex: pythonResponse.data.nextIndex
    });

  } catch (error) {
    console.error("Load more error:", error.message);
    res.status(500).json({ error: "Failed to load more flashcards" });
  }
});

/* =========================
   DOUBT SOLVER (FUTURE)
========================= */
app.post("/ask-doubt", (req, res) => {
  const { question } = req.body;

  res.json({
    answer: "This is a sample AI answer to your doubt: " + question
  });
});

/* =========================
   SERVER START
========================= */
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
