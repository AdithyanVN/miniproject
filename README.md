# Summarify — AI Web Content Summarizer

Summarify is a browser-based summarization app that helps users condense long content into concise insights.

## Features
- AI-powered abstractive summarization via Hugging Face (BART-large-CNN)
- Multiple input modes:
  - Paste text manually
  - Extract content from webpage URL
  - Upload files (`.txt`, `.pdf`, `.doc`, `.docx`)
- Summary quality metrics (word count, sentence count, compression ratio, one-third-rule check)
- Important point extraction from generated summary
- Download summary as:
  - `.txt`
  - `.pdf`

## Tech Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- AI Model API: Hugging Face Inference Router

## Project Structure
- `backend/server.js` — Express server, extraction endpoints, summarization route
- `backend/summarizer.js` — local extractive summarizer utility (not currently wired to API)
- `frontend/index.html` — landing page + app UI sections
- `frontend/styles.css` — professional UI styling and animations
- `frontend/app.js` — tab logic, extraction calls, summarization, and download actions

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `backend/.env`:
   ```env
   HF_API_KEY=your_huggingface_token
   PORT=3000
   ```
3. Start app:
   ```bash
   npm start
   ```
4. Open `http://localhost:3000`

## Notes
- URL extraction strips HTML tags and script/style content before summarization.
- `.txt` extraction is most accurate.
- `.pdf/.doc/.docx` extraction uses lightweight fallback parsing in this version; richer parsing can be added later with dedicated libraries.
