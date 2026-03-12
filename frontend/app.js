const tabs = document.querySelectorAll('.tab');
const manualPanel = document.getElementById('panel-manual');
const urlPanel = document.getElementById('panel-url');
const filePanel = document.getElementById('panel-file');

const manualTextEl = document.getElementById('manualText');
const urlInputEl = document.getElementById('urlInput');
const fileInputEl = document.getElementById('fileInput');
const statusEl = document.getElementById('status');
const loadingEl = document.getElementById('loading');

const summaryEl = document.getElementById('summary');
const keywordsEl = document.getElementById('keywords');
const pointsEl = document.getElementById('points');
const metricsEl = document.getElementById('metrics');

const summarizeBtn = document.getElementById('summarizeBtn');
const downloadToggle = document.getElementById('downloadToggle');
const downloadMenu = document.getElementById('downloadMenu');
const downloadTxtBtn = document.getElementById('downloadTxtBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');

let activeTab = 'manual';
let latestSummary = '';

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#ff9ea0' : '#8bf5c9';
}

function showLoading(show) {
  loadingEl.classList.toggle('hidden', !show);
}

function resetResults() {
  summaryEl.textContent = 'Your generated summary will appear here.';
  keywordsEl.textContent = '—';
  pointsEl.innerHTML = '<li>No key points yet.</li>';
  metricsEl.textContent = 'No metrics yet.';
  latestSummary = '';
}

function activateTab(tabName) {
  activeTab = tabName;
  tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
  manualPanel.classList.toggle('hidden', tabName !== 'manual');
  urlPanel.classList.toggle('hidden', tabName !== 'url');
  filePanel.classList.toggle('hidden', tabName !== 'file');
  setStatus('');
}

tabs.forEach(btn => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));

downloadToggle.addEventListener('click', () => {
  downloadMenu.classList.toggle('hidden');
});

document.addEventListener('click', event => {
  if (!downloadToggle.contains(event.target) && !downloadMenu.contains(event.target)) {
    downloadMenu.classList.add('hidden');
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

async function getInputTextBySource() {
  if (activeTab === 'manual') {
    const text = manualTextEl.value.trim();
    if (!text || text.length < 100) {
      throw new Error('Please paste at least 100 characters.');
    }
    return text;
  }

  if (activeTab === 'url') {
    const url = urlInputEl.value.trim();
    if (!url) {
      throw new Error('Please provide a webpage URL.');
    }
    setStatus('Extracting text from URL...');
    const extracted = await fetchJson('/extract-url', { url });
    if (!extracted.text || extracted.text.length < 100) {
      throw new Error('Could not extract enough text from this URL.');
    }
    return extracted.text;
  }

  if (activeTab === 'file') {
    const file = fileInputEl.files?.[0];
    if (!file) {
      throw new Error('Please choose a file first.');
    }

    setStatus('Reading file and extracting text...');
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }

    const base64Content = btoa(binary);
    const extracted = await fetchJson('/extract-file', {
      fileName: file.name,
      base64Content
    });

    if (!extracted.text || extracted.text.length < 100) {
      throw new Error('Could not extract enough text from this file.');
    }

    return extracted.text;
  }

  throw new Error('Invalid input mode selected.');
}

summarizeBtn.addEventListener('click', async () => {
  try {
    resetResults();
    showLoading(true);

    const text = await getInputTextBySource();
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
      pointsEl.innerHTML = '<li>No key points extracted.</li>';
    }

    if (data.metrics) {
      metricsEl.innerHTML = `
        <strong>Original:</strong> ${data.metrics.originalWordCount} words, ${data.metrics.originalSentenceCount} sentences<br>
        <strong>Summary:</strong> ${data.metrics.summaryWordCount} words, ${data.metrics.summarySentenceCount} sentences<br>
        <strong>Compression:</strong> ${data.metrics.compressionRatio}%<br>
        <strong>1/3 Rule Followed:</strong> ${data.metrics.withinRecommendedLength ? 'Yes' : 'No'}
      `;
    }

    setStatus('Summary ready. Use Download to export as TXT or PDF.');
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    showLoading(false);
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
  downloadMenu.classList.add('hidden');
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
  downloadBlob('summary.pdf', buildSimplePdf(latestSummary), 'application/pdf');
  setStatus('Downloaded summary.pdf');
  downloadMenu.classList.add('hidden');
});
