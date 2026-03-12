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
- AI API: Hugging Face Inference Router

## Project Structure
- `backend/server.js` — extraction endpoints, summarization route, metrics/keywords generation
- `backend/summarizer.js` — optional local extractive utility (not currently wired)
- `frontend/index.html` — multi-section UI and app layout
- `frontend/styles.css` — visual design, hover effects, animations
- `frontend/app.js` — source-tab logic, summarize workflow, and export actions
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
3. Start the app:
3. Start app:
   ```bash
   npm start
   ```
4. Open `http://localhost:3000`

## Notes
- URL extraction works better for public article pages and may fail on heavily protected websites.
- `.txt` extraction is most accurate in this version.
- `.pdf/.doc/.docx` use lightweight fallback extraction and can be improved later with dedicated parser libraries.

## Resolving PR Conflicts (Recommended Workflow)
If GitHub shows **Resolve conflicts** for this PR, avoid blindly clicking **Accept incoming** for every block.

### Quick rule
- **Accept current**: keep this branch’s AIWOCS redesign behavior.
- **Accept incoming**: only when the target branch has a newer fix you definitely need.
- **Manual combine**: preferred for most conflicts in this project.

### File-by-file guidance
- `frontend/index.html` + `frontend/app.js` + `frontend/styles.css`
  - Resolve these together as one UI system.
  - Keep matching IDs/classes between HTML and JS (`manualText`, `urlInput`, `fileInput`, `summary`, `keywords`, `points`, `metrics`, `downloadMenu`).
  - Keep the current two-panel Try Now layout and download dropdown behavior.

- `backend/server.js`
  - Keep helper functions: `normalizeUrl`, `stripHtmlToText`, `extractTextFromUploadedFile`, `extractKeywords`.
  - Keep routes: `POST /extract-url`, `POST /extract-file`, `POST /summarize`, and compatibility `POST /scrape`.
  - Ensure response field naming stays consistent with frontend (`withinRecommendedLength`, `keywords`, `points`).

- `README.md`
  - Prefer manual text merge to preserve project branding (`AIWOCS`) and setup instructions.

### Safe local flow
```bash
git fetch origin
git checkout work
git merge origin/main
# resolve files, then
git add README.md backend/server.js frontend/index.html frontend/app.js frontend/styles.css
npm run check
git commit -m "Resolve merge conflicts with main"
git push
```

### Post-merge sanity checks
```bash
npm run check
npm start
```
Open `http://localhost:3000` and verify manual/url/file input mode, summary generation path, and download dropdown.
- URL extraction strips HTML tags and script/style content before summarization.
- `.txt` extraction is most accurate.
- `.pdf/.doc/.docx` extraction uses lightweight fallback parsing in this version; richer parsing can be added later with dedicated libraries.
