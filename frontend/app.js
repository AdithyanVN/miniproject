async function summarize() {
  const inputEl = document.getElementById("inputText");
  const summaryEl = document.getElementById("summary");
  const keywordsEl = document.getElementById("keywords");
  const pointsList = document.getElementById("points");
  const metricsEl = document.getElementById("metrics");

  const text = inputEl.value.trim();

  if (!text || text.length < 100) {
    alert("Please enter at least 100 characters.");
    return;
  }

  // Clear previous results
  summaryEl.innerText = "Generating summary...";
  keywordsEl.innerText = "";
  pointsList.innerHTML = "";
  if (metricsEl) metricsEl.innerText = "";

  try {
    const response = await fetch("http://localhost:3000/summarize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Server error occurred.");
    }

    // Display summary
    summaryEl.innerText = data.summary || "No summary generated.";

    // Display keywords (if implemented later)
    if (Array.isArray(data.keywords) && data.keywords.length > 0) {
      keywordsEl.innerText = data.keywords.join(", ");
    } else {
      keywordsEl.innerText = "—";
    }

    // Display bullet points
    pointsList.innerHTML = "";
    if (Array.isArray(data.points)) {
      data.points.forEach(point => {
        const li = document.createElement("li");
        li.innerText = point;
        pointsList.appendChild(li);
      });
    }

if (data.metrics && metricsEl) {
  metricsEl.innerHTML = `
    <strong>Original Text:</strong><br>
    Words: ${data.metrics.originalWordCount} |
    Sentences: ${data.metrics.originalSentenceCount}
    <br><br>
    <strong>Summary:</strong><br>
    Words: ${data.metrics.summaryWordCount} |
    Sentences: ${data.metrics.summarySentenceCount}
    <br><br>
    Compression Ratio: ${data.metrics.compressionRatio}%<br>
    1/3 Rule Followed: ${data.metrics.followsOneThirdRule ? "Yes" : "No"}
  `;
}

  } catch (error) {
    console.error("Error:", error.message);
    summaryEl.innerText = "An error occurred while generating the summary.";
  }
}