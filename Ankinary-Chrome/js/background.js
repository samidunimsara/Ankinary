// Create context menu
var context = {
  id: "select_word",
  title: "Save word",
  contexts: ["selection"],
};

chrome.contextMenus.create(context, () => chrome.runtime.lastError);

// Context menu click handler — save word locally
chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId === "select_word" && info.selectionText != undefined) {
    let selectedText = info.selectionText.trim().toLowerCase();
    if (!selectedText) return;
    saveWordLocally(selectedText);
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "LOOKUP_WORD") {
    lookupWord(request.word, request.source)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true; // keep channel open for async
  }

  if (request.type === "SAVE_WORD") {
    saveWordLocally(request.word, request.definition)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
});

// ─── Save word to local storage ───
async function saveWordLocally(wordName, definition) {
  return new Promise((resolve) => {
    chrome.storage.local.get("words", (data) => {
      const words = data.words || [];
      const name = wordName.trim().toLowerCase();
      const exists = words.some((w) => w.name === name);
      if (exists) {
        resolve({ success: false, reason: "exists" });
        return;
      }
      const newWord = {
        _id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        name: name,
        definition: definition || "",
        createdAt: new Date().toISOString(),
      };
      words.unshift(newWord);
      chrome.storage.local.set({ words }, () => {
        chrome.runtime
          .sendMessage({ type: "WORDS_UPDATED" })
          .catch(() => {});
        resolve({ success: true });
      });
    });
  });
}

// ─── Lookup word from dictionaries ───
async function lookupWord(word, source) {
  const clean = word.trim().toLowerCase();
  const isPhrase = clean.includes(" ");

  // For single words, try dictionary sources first
  if (!isPhrase) {
    if (source === "cambridge") {
      try {
        const r = await fetchCambridge(clean);
        if (r && r.definitions.length > 0) return r;
      } catch (e) { /* fall through */ }
    }
    if (source === "oxford") {
      try {
        const r = await fetchOxford(clean);
        if (r && r.definitions.length > 0) return r;
      } catch (e) { /* fall through */ }
    }
    // Always try free dictionary API as reliable source
    try {
      const r = await fetchFreeDictionary(clean);
      if (r && r.definitions.length > 0) return r;
    } catch (e) { /* fall through */ }
  }

  // For phrases or if dictionary failed, try Wikipedia
  try {
    const r = await fetchWikipedia(clean);
    if (r && r.definitions.length > 0) return r;
  } catch (e) { /* fall through */ }

  // Final fallback — return empty with search links
  return {
    word: clean,
    phonetic: "",
    audio: "",
    source: "none",
    definitions: [],
    cambridgeUrl: `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(clean)}`,
    oxfordUrl: `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(clean.replace(/\s+/g, "-"))}`,
    googleUrl: `https://www.google.com/search?q=define+${encodeURIComponent(clean)}`,
    wikiUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(clean.replace(/\s+/g, "_"))}`,
  };
}

// ─── Free Dictionary API ───
async function fetchFreeDictionary(word) {
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const entry = data[0];
  const phonetic = entry.phonetic || (entry.phonetics?.find((p) => p.text)?.text) || "";
  const audio = entry.phonetics?.find((p) => p.audio)?.audio || "";
  const definitions = [];

  for (const meaning of entry.meanings || []) {
    for (const def of meaning.definitions || []) {
      definitions.push({
        partOfSpeech: meaning.partOfSpeech || "",
        definition: def.definition || "",
        example: def.example || "",
      });
    }
  }

  return {
    word: entry.word,
    phonetic,
    audio,
    source: "Free Dictionary (Wiktionary)",
    definitions,
    cambridgeUrl: `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word)}`,
    oxfordUrl: `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(word)}`,
    googleUrl: `https://www.google.com/search?q=define+${encodeURIComponent(word)}`,
    wikiUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(word)}`,
  };
}

// ─── Cambridge Dictionary (HTML scraping) ───
async function fetchCambridge(word) {
  const url = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" },
  });
  if (!res.ok) return null;
  const html = await res.text();

  const definitions = [];

  // Match definition blocks: <div class="def-body ddef_b"> contains defs and examples
  const senseRegex = /<div class="def-body ddef_b">([\s\S]*?)<\/div>\s*<\/div>/g;
  const defRegex = /<div class="def ddef_d db">([\s\S]*?)<\/div>/;
  const exRegex = /<span class="eg deg">([\s\S]*?)<\/span>/g;
  const posRegex = /<span class="pos dpos"[^>]*>([\s\S]*?)<\/span>/;

  // Simpler approach: extract all defs
  const allDefs = html.matchAll(/<div class="def ddef_d db">([\s\S]*?)<\/div>/g);
  const allExamples = [...html.matchAll(/<span class="eg deg">([\s\S]*?)<\/span>/g)];
  const posMatch = html.match(posRegex);
  const pos = posMatch ? stripTags(posMatch[1]) : "";

  let i = 0;
  for (const m of allDefs) {
    definitions.push({
      partOfSpeech: pos,
      definition: stripTags(m[1]).trim().replace(/\s+/g, " "),
      example: allExamples[i] ? stripTags(allExamples[i][1]).trim() : "",
    });
    i++;
    if (i >= 8) break;
  }

  return {
    word,
    phonetic: "",
    audio: "",
    source: "Cambridge Dictionary",
    definitions,
    cambridgeUrl: url,
    oxfordUrl: `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(word)}`,
    googleUrl: `https://www.google.com/search?q=define+${encodeURIComponent(word)}`,
    wikiUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(word)}`,
  };
}

// ─── Oxford Dictionary (HTML scraping) ───
async function fetchOxford(word) {
  const slug = word.replace(/\s+/g, "-");
  const url = `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(slug)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" },
  });
  if (!res.ok) return null;
  const html = await res.text();

  const definitions = [];
  const posMatch = html.match(/<span class="pos"[^>]*>([\s\S]*?)<\/span>/);
  const pos = posMatch ? stripTags(posMatch[1]) : "";

  const allDefs = html.matchAll(/<span class="def"[^>]*>([\s\S]*?)<\/span>/g);
  const allExamples = [...html.matchAll(/<span class="x"[^>]*>([\s\S]*?)<\/span>/g)];

  let i = 0;
  for (const m of allDefs) {
    definitions.push({
      partOfSpeech: pos,
      definition: stripTags(m[1]).trim().replace(/\s+/g, " "),
      example: allExamples[i] ? stripTags(allExamples[i][1]).trim() : "",
    });
    i++;
    if (i >= 8) break;
  }

  return {
    word,
    phonetic: "",
    audio: "",
    source: "Oxford Learner's Dictionary",
    definitions,
    cambridgeUrl: `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word)}`,
    oxfordUrl: url,
    googleUrl: `https://www.google.com/search?q=define+${encodeURIComponent(word)}`,
    wikiUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(word)}`,
  };
}

// ─── Wikipedia API ───
async function fetchWikipedia(phrase) {
  const title = phrase.replace(/\s+/g, "_");
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url, {
    headers: { "Api-User-Agent": "myVocabs-Extension/5.1" },
  });
  if (!res.ok) return null;
  const data = await res.json();

  if (data.type === "disambiguation" || !data.extract) return null;

  return {
    word: data.title || phrase,
    phonetic: "",
    audio: "",
    source: "Wikipedia",
    definitions: [
      {
        partOfSpeech: data.description || "",
        definition: data.extract || "",
        example: "",
      },
    ],
    cambridgeUrl: `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(phrase)}`,
    oxfordUrl: `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(phrase.replace(/\s+/g, "-"))}`,
    googleUrl: `https://www.google.com/search?q=define+${encodeURIComponent(phrase)}`,
    wikiUrl: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
  };
}

// ─── Strip HTML tags ───
function stripTags(html) {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, " ");
}
