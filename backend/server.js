import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";

// Resolve correct path for .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("Backend is running!");
});

// AI Summarization Route
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

    // Handle HuggingFace errors
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
const originalSentenceCount = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;

const summaryWordCount = summary.split(/\s+/).length;
const summarySentenceCount = summary.split(/[.!?]+/).filter(s => s.trim().length > 0).length;

const compressionRatio = (
  ((originalWordCount - summaryWordCount) / originalWordCount) * 100
).toFixed(2);

const followsOneThirdRule = summaryWordCount <= originalWordCount / 3;

    // Clean bullet point extraction
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
    followsOneThirdRule
  },
  mode: "ai-abstractive"
});

  } catch (error) {
    console.error("Server Error:", error.message);
    res.status(500).json({
      error: "AI summarization failed."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});