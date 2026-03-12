import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";

// Resolve directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Serve frontend assets
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

function stripHtmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTextFromUploadedFile(fileName, base64Content) {
  const extension = (path.extname(fileName || "") || "").toLowerCase();
  const buffer = Buffer.from(base64Content || "", "base64");

  // Full fidelity text extraction is straightforward for plain text.
  if (extension === ".txt" || extension === ".md" || extension === ".csv") {
    return buffer.toString("utf8").replace(/\s+/g, " ").trim();
  }

  // Basic fallback extraction for binary containers (.pdf/.doc/.docx):
  // keeps readable printable runs so users can still try summarization.
  // For production-quality parsing, plug in dedicated parsers.
  if ([".pdf", ".doc", ".docx"].includes(extension)) {
    const latin = buffer.toString("latin1");
    const candidates = latin
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return candidates;
  }

  throw new Error("Unsupported file type. Please upload .txt, .pdf, .doc, or .docx.");
}

// Extract text from a webpage URL
app.post("/extract-url", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required." });
    }

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(400).json({ error: "Failed to fetch the provided URL." });
    }

    const html = await response.text();
    const text = stripHtmlToText(html);

    if (!text || text.length < 100) {
      return res.status(400).json({ error: "Unable to extract enough readable text from this URL." });
    }

    res.json({ text });
  } catch (error) {
    res.status(500).json({ error: "Failed to extract text from webpage." });
  }
});

// Extract text from uploaded file content
app.post("/extract-file", (req, res) => {
  try {
    const { fileName, base64Content } = req.body;

    if (!fileName || !base64Content) {
      return res.status(400).json({ error: "fileName and base64Content are required." });
    }

    const text = extractTextFromUploadedFile(fileName, base64Content);

    if (!text || text.length < 60) {
      return res.status(400).json({
        error: "Could not extract enough readable text from this file. Try .txt or paste text manually."
      });
    }

    res.json({ text });
  } catch (error) {
    res.status(400).json({ error: error.message || "Failed to extract text from file." });
  }
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

    const withinRecommendedLength = summaryWordCount <= originalWordCount / 3;

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
      error: "AI summarization failed. Ensure HF_API_KEY is configured and network is available."
    });
  }
});

// Backward-compatible alias for older frontend clients
app.post("/scrape", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required." });
    }

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(400).json({ error: "Failed to fetch the provided URL." });
    }

    const html = await response.text();
    const text = stripHtmlToText(html);

    if (!text || text.length < 100) {
      return res.status(400).json({ error: "Unable to extract enough readable text from this URL." });
    }

    res.json({ text });
  } catch (error) {
    res.status(500).json({ error: "Failed to scrape webpage." });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
