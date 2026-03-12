# AIWOCS — AI Web Content Summarizer

AIWOCS is a browser-based summarization web app built as a **B.Tech Mini Project** by a team of 5 students.
It helps users turn long content into concise insights quickly.

## Features
- AI-powered abstractive summarization via Hugging Face (BART-large-CNN)
- Simple one-click summarize flow from any one input mode:
  - Paste text manually
  - Provide webpage URL
  - Upload files (`.txt`, `.pdf`, `.doc`, `.docx`)
- Summary insights:
  - keywords
  - important points
  - word/sentence metrics + compression ratio + one-third rule check
- Download summary as:
  - `.txt`
  - `.pdf`

## Tech Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- AI API: Hugging Face Inference Router

## Project Structure
- `backend/server.js` — extraction endpoints, summarization route, metrics/keywords generation
- `backend/summarizer.js` — optional local extractive utility (not currently wired)
- `frontend/index.html` — multi-section UI and app layout
- `frontend/styles.css` — visual design, hover effects, animations
- `frontend/app.js` — source-tab logic, summarize workflow, and export actions

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
3. Start the app:
   ```bash
   npm start
   ```
4. Open `http://localhost:3000`

## Notes
- URL extraction works better for public article pages and may fail on heavily protected websites.
- `.txt` extraction is most accurate in this version.
- `.pdf/.doc/.docx` use lightweight fallback extraction and can be improved later with dedicated parser libraries.
