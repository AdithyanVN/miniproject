import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import cheerio from "cheerio";

// Resolve directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve frontend (important for deployment)
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// -----------------------------
// Web Scraping Route
// -----------------------------
app.post("/scrape", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required." });
    }

    const response = await fetch(url);
    const html = await response.text();

    const $ = cheerio.load(html);

    $("script, style, noscript").remove();

    const text = $("body")
      .text()
      .replace(/\s+/g, " ")
      .trim();

    res.json({ text });

  } catch (error) {
    res.status(500).json({ error: "Failed to scrape webpage." });
  }
});

// -----------------------------
// AI Summarization Route
// -----------------------------
app.post("/summarize", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.length < 100) {
      return res.status(400).json({
        error: "Please provide sufficient text (minimum 100 characters)."
      });
    }

    const hfResponse = await fetch(
      "https://router.huggingface.co/hf-inference/models/facebook/bart-large-cnn",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputs: text,
          parameters: {
            max_length: 180,
            min_length: 80,
            do_sample: false,
            length_penalty: 2.0,
            repetition_penalty: 1.2,
            early_stopping: true
          }
        })
      }
    );

    const result = await hfResponse.json();

    if (!hfResponse.ok || result.error) {
      return res.status(500).json({
        error: result.error || "HuggingFace inference error."
      });
    }

    if (!result[0]?.summary_text) {
      return res.status(500).json({
        error: "Invalid response format from HuggingFace."
      });
    }

    const summary = result[0].summary_text.trim();

    // ---- METRICS ----
    const originalWordCount = text.trim().split(/\s+/).length;
    const originalSentenceCount = text
      .split(/[.!?]+/)
      .filter(s => s.trim().length > 0).length;

    const summaryWordCount = summary.split(/\s+/).length;
    const summarySentenceCount = summary
      .split(/[.!?]+/)
      .filter(s => s.trim().length > 0).length;

    const compressionRatio = (
      ((originalWordCount - summaryWordCount) / originalWordCount) * 100
    ).toFixed(2);

    const recommendedLengthPercentage = 33;
    const actualLengthPercentage = (
      (summaryWordCount / originalWordCount) * 100
    ).toFixed(2);

    const withinRecommendedLength =
      summaryWordCount <= originalWordCount / 3;

    const points = summary
      .split(/(?<=\.)\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 25);

    res.json({
      summary,
      keywords: [],
      points,
      metrics: {
        originalWordCount,
        originalSentenceCount,
        summaryWordCount,
        summarySentenceCount,
        compressionRatio,
        recommendedLengthPercentage,
        actualLengthPercentage,
        withinRecommendedLength
      },
      mode: "ai-abstractive-online"
    });

  } catch (error) {
    console.error("Server Error:", error.message);
    res.status(500).json({
      error: "AI summarization failed."
    });
  }
});

// Catch-all (important for frontend routing)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});