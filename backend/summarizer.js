// backend/summarizer.js

export function summarizeText(text) {
  // 1. Clean text
  const cleanText = text
    .replace(/\s+/g, " ")
    .replace(/[^\w\s.]/g, "")
    .toLowerCase();

  // 2. Split into sentences
  const sentences = cleanText.split(".").filter(s => s.length > 30);

  // 3. Stopwords (basic set)
  const stopwords = new Set([
    "the","is","in","and","to","of","a","for","on","with","as","by",
    "an","be","are","this","that","it","from","or","at","was","were"
  ]);

  // 4. Word frequency
  const wordFreq = {};
  cleanText.split(" ").forEach(word => {
    if (!stopwords.has(word) && word.length > 3) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });

  // 5. Sentence scoring
  const sentenceScores = sentences.map(sentence => {
    let score = 0;
    sentence.split(" ").forEach(word => {
      score += wordFreq[word] || 0;
    });
    return { sentence, score };
  });

  // 6. Sort by importance
  sentenceScores.sort((a, b) => b.score - a.score);

  // 7. Pick top sentences
  const summarySentences = sentenceScores
    .slice(0, 4)
    .map(s => s.sentence.trim());

  // 8. Keywords
  const keywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);

  return {
    summary: summarySentences.join(". ") + ".",
    keywords,
    points: summarySentences
  };
}
