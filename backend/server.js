import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3000;
const HF_MODEL_URL = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-cnn";
const HF_MAX_CHUNK_WORDS = 280;
const HF_REDUCTION_PASSES = 3;
const HF_MIN_CHUNK_WORDS = 80;

app.use(cors());
app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

function stripHtmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
}

function extractTextFromUploadedFile(fileName, base64Content) {
  const extension = (path.extname(fileName || "") || "").toLowerCase();
  const buffer = Buffer.from(base64Content || "", "base64");

  if ([".txt", ".md", ".csv"].includes(extension)) {
    return buffer.toString("utf8").replace(/\s+/g, " ").trim();
  }

  if ([".pdf", ".doc", ".docx"].includes(extension)) {
    return buffer
      .toString("latin1")
      .replace(/[^\x20-\x7E\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  throw new Error("Unsupported file type. Please upload .txt, .pdf, .doc, or .docx.");
}

function extractKeywords(text, maxCount = 8) {
  const stopwords = new Set([
    "the", "is", "in", "and", "to", "of", "a", "for", "on", "with", "as", "by", "an", "be", "are", "this", "that", "it", "from", "or", "at", "was", "were", "has", "have", "had", "not", "but", "into", "their", "they", "them", "its", "can", "will", "would", "should", "about", "over", "under", "than", "also"
  ]);

  const freq = {};
  (text.toLowerCase().match(/\b[a-z]{4,}\b/g) || []).forEach(word => {
    if (!stopwords.has(word)) {
      freq[word] = (freq[word] || 0) + 1;
    }
  });

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCount)
    .map(([word]) => word);
}

function chunkTextByWords(text, maxWords = HF_MAX_CHUNK_WORDS) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return [text.trim()];

  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(" "));
  }
  return chunks;
}

async function summarizeWithHuggingFace(inputText) {
  const hfResponse = await fetch(HF_MODEL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: inputText,
      parameters: {
        max_length: 180,
        min_length: 80,
        do_sample: false,
        length_penalty: 2.0,
        repetition_penalty: 1.2,
        early_stopping: true
      }
    })
  });

  const result = await hfResponse.json();

  if (!hfResponse.ok || result?.error) {
    const modelError = result?.error || "HuggingFace inference error.";
    if (/index out of range|input is too long|max(?:imum)? (?:length|tokens)|token/i.test(modelError)) {
      throw new Error(`MODEL_OVERFLOW:${modelError}`);
    }
    throw new Error(modelError);
  }

  const summaryText = Array.isArray(result)
    ? result[0]?.summary_text
    : result?.summary_text;

  if (!summaryText) {
    throw new Error("Invalid response format from HuggingFace.");
  }

  return summaryText.trim();
}

function splitChunkInHalf(chunkText) {
  const words = chunkText.trim().split(/\s+/).filter(Boolean);
  if (words.length <= HF_MIN_CHUNK_WORDS) return [chunkText];

  const middle = Math.floor(words.length / 2);
  const first = words.slice(0, middle).join(" ");
  const second = words.slice(middle).join(" ");
  return [first, second].filter(Boolean);
}

async function summarizeChunkWithBackoff(chunkText) {
  try {
    return await summarizeWithHuggingFace(chunkText);
  } catch (error) {
    if (!String(error.message || "").startsWith("MODEL_OVERFLOW:")) {
      throw error;
    }

    const subChunks = splitChunkInHalf(chunkText);
    if (subChunks.length === 1 || subChunks[0] === chunkText) {
      throw new Error("Input is too long for model context limits. Try a shorter section.");
    }

    const summaries = [];
    for (const subChunk of subChunks) {
      summaries.push(await summarizeChunkWithBackoff(subChunk));
    }
    return summaries.join(" ");
  }
}

async function summarizeLongText(text) {
  let workingText = text;

  for (let pass = 0; pass < HF_REDUCTION_PASSES; pass += 1) {
    const chunks = chunkTextByWords(workingText, HF_MAX_CHUNK_WORDS);

    if (chunks.length === 1) {
      return summarizeWithHuggingFace(chunks[0]);
    }

    const chunkSummaries = [];
    for (const chunk of chunks) {
      const summary = await summarizeChunkWithBackoff(chunk);
      chunkSummaries.push(summary);
    }

    workingText = chunkSummaries.join(" ");
  }

  const finalChunks = chunkTextByWords(workingText, HF_MAX_CHUNK_WORDS);
  if (finalChunks.length === 1) {
    return summarizeChunkWithBackoff(finalChunks[0]);
  }
  return summarizeChunkWithBackoff(finalChunks.join(" "));
}

async function fetchPageTextFromUrl(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  if (!response.ok) {
    throw new Error("Failed to fetch the provided URL.");
  }

  const html = await response.text();
  return stripHtmlToText(html);
}

app.post("/extract-url", async (req, res) => {
  try {
    const normalizedUrl = normalizeUrl(req.body?.url);
    if (!normalizedUrl) {
      return res.status(400).json({ error: "Please provide a valid URL." });
    }

    const text = await fetchPageTextFromUrl(normalizedUrl);
    if (!text || text.length < 100) {
      return res.status(400).json({ error: "Unable to extract enough readable text from this URL." });
    }

    res.json({ text });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to extract text from webpage." });
  }
});

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

app.post("/summarize", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.length < 100) {
      return res.status(400).json({
        error: "Please provide sufficient text (minimum 100 characters)."
      });
    }

    if (!process.env.HF_API_KEY) {
      return res.status(500).json({
        error: "HF_API_KEY is missing on server. Please configure backend/.env."
      });
    }

    const cleanInputText = text.replace(/\s+/g, " ").trim();
    const summary = await summarizeLongText(cleanInputText);

    const originalWordCount = cleanInputText.split(/\s+/).length;
    const originalSentenceCount = cleanInputText
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
      .filter(s => s.length > 20);

    const keywords = extractKeywords(summary.length > 150 ? summary : cleanInputText, 8);

    res.json({
      summary,
      keywords,
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
    const msg = String(error.message || "");
    if (msg.startsWith("MODEL_OVERFLOW:")) {
      return res.status(400).json({
        error: "Input is too large for one AI pass. The server attempted chunking, but this content still exceeded model context. Please try a smaller section."
      });
    }

    res.status(500).json({
      error: msg || "AI summarization failed. Ensure HF_API_KEY is configured and network is available."
    });
  }
});

app.post("/scrape", async (req, res) => {
  try {
    const normalizedUrl = normalizeUrl(req.body?.url);
    if (!normalizedUrl) {
      return res.status(400).json({ error: "Please provide a valid URL." });
    }

    const text = await fetchPageTextFromUrl(normalizedUrl);
    if (!text || text.length < 100) {
      return res.status(400).json({ error: "Unable to extract enough readable text from this URL." });
    }

    res.json({ text });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to scrape webpage." });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
