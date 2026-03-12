const tabs = document.querySelectorAll('.tab');
const manualPanel = document.getElementById('panel-manual');
const urlPanel = document.getElementById('panel-url');
const filePanel = document.getElementById('panel-file');

const manualTextEl = document.getElementById('manualText');
const inputTextEl = document.getElementById('inputText');
const urlInputEl = document.getElementById('urlInput');
const fileInputEl = document.getElementById('fileInput');
const statusEl = document.getElementById('status');

const summaryEl = document.getElementById('summary');
const keywordsEl = document.getElementById('keywords');
const pointsEl = document.getElementById('points');
const metricsEl = document.getElementById('metrics');

const fetchUrlBtn = document.getElementById('fetchUrlBtn');
const extractFileBtn = document.getElementById('extractFileBtn');
const summarizeBtn = document.getElementById('summarizeBtn');
const downloadTxtBtn = document.getElementById('downloadTxtBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');

document.getElementById('year').textContent = new Date().getFullYear();

let latestSummary = '';

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#ff9ea0' : '#8bf4c5';
}

function activateTab(tabName) {
  tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
  manualPanel.classList.toggle('hidden', tabName !== 'manual');
  urlPanel.classList.toggle('hidden', tabName !== 'url');
  filePanel.classList.toggle('hidden', tabName !== 'file');
}

tabs.forEach(btn => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});

manualTextEl.addEventListener('input', () => {
  if (manualTextEl.value.trim().length > 0) {
    inputTextEl.value = manualTextEl.value;
  }
});

async function fetchJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}

fetchUrlBtn.addEventListener('click', async () => {
  const url = urlInputEl.value.trim();
  if (!url) return setStatus('Please enter a URL first.', true);

  try {
    setStatus('Extracting text from webpage...');
    const data = await fetchJson('/extract-url', { url });
    inputTextEl.value = data.text;
    setStatus('Webpage text extracted. You can now summarize it.');
  } catch (error) {
    setStatus(error.message, true);
  }
});

extractFileBtn.addEventListener('click', async () => {
  const file = fileInputEl.files?.[0];
  if (!file) return setStatus('Please select a file first.', true);

  try {
    setStatus('Reading file and extracting text...');
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Chunk-safe base64 conversion for browser environments.
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const sub = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...sub);
    }

    const base64Content = btoa(binary);
    const data = await fetchJson('/extract-file', {
      fileName: file.name,
      base64Content
    });

    inputTextEl.value = data.text;
    setStatus('File text extracted. You can now summarize it.');
  } catch (error) {
    setStatus(error.message, true);
  }
});

summarizeBtn.addEventListener('click', async () => {
  const text = inputTextEl.value.trim();
  if (!text || text.length < 100) {
    return setStatus('Please provide at least 100 characters to summarize.', true);
  }

  try {
    setStatus('Generating AI summary...');

    const data = await fetchJson('/summarize', { text });

    latestSummary = data.summary || '';
    summaryEl.textContent = latestSummary || 'No summary generated.';

    keywordsEl.textContent = Array.isArray(data.keywords) && data.keywords.length
      ? data.keywords.join(', ')
      : '—';

    pointsEl.innerHTML = '';
    if (Array.isArray(data.points) && data.points.length) {
      data.points.forEach(point => {
        const li = document.createElement('li');
        li.textContent = point;
        pointsEl.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.textContent = 'No key points extracted.';
      pointsEl.appendChild(li);
    }

    if (data.metrics) {
      metricsEl.innerHTML = `
        <strong>Original:</strong> ${data.metrics.originalWordCount} words, ${data.metrics.originalSentenceCount} sentences<br>
        <strong>Summary:</strong> ${data.metrics.summaryWordCount} words, ${data.metrics.summarySentenceCount} sentences<br>
        <strong>Compression:</strong> ${data.metrics.compressionRatio}%<br>
        <strong>1/3 Rule Followed:</strong> ${data.metrics.withinRecommendedLength ? 'Yes' : 'No'}
      `;
    }

    setStatus('Summary ready. You can download it as TXT or PDF.');
  } catch (error) {
    setStatus(error.message, true);
  }
});

function downloadBlob(filename, blob, type = 'application/octet-stream') {
  const finalBlob = blob instanceof Blob ? blob : new Blob([blob], { type });
  const url = URL.createObjectURL(finalBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

downloadTxtBtn.addEventListener('click', () => {
  if (!latestSummary) return setStatus('Generate a summary before downloading.', true);
  downloadBlob('summary.txt', latestSummary, 'text/plain;charset=utf-8');
  setStatus('Downloaded summary.txt');
});

function escapePdfText(text) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildSimplePdf(text) {
  const lines = text.match(/.{1,88}(\s|$)/g) || [text];
  const content = lines
    .map((line, i) => `1 0 0 1 40 ${780 - i * 14} Tm (${escapePdfText(line.trim())}) Tj`)
    .join('\n');

  const stream = `BT\n/F1 11 Tf\n${content}\nET`;

  const objects = [];
  objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
  objects.push('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj');
  objects.push('3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj');
  objects.push('4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj');
  objects.push(`5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach(obj => {
    offsets.push(pdf.length);
    pdf += `${obj}\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

downloadPdfBtn.addEventListener('click', () => {
  if (!latestSummary) return setStatus('Generate a summary before downloading.', true);
  const pdfBlob = buildSimplePdf(latestSummary);
  downloadBlob('summary.pdf', pdfBlob, 'application/pdf');
  setStatus('Downloaded summary.pdf');
});
