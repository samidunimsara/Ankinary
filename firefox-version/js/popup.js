const con_words = document.querySelector(".con_words_save_words_extension");
const wordExist = document.querySelector("#exist_word_save_words_extension");
const addWordForm = document.querySelector("form");
const addWordButton = document.querySelector("form button");
const addWordInput = document.querySelector("input[type='text']");
const the_page = document.querySelector(".the_page_save_words_extension");
const noWordsMessage = document.querySelector(".no_words_message");
const content = document.querySelector(".con_content");
const loading = document.querySelector(".loading");
const error = document.querySelector(".error");
const wordCountElement = document.querySelector("#word-count");
const searchInput = document.querySelector("#search-input");
const sortSelect = document.querySelector("#sort-select");
const exportBtn = document.querySelector("#export-btn");
const importBtn = document.querySelector("#import-btn");
const importFile = document.querySelector("#import-file");
const dictSourceSelect = document.querySelector("#dict-source-select");

let allWords = [];

// Show content immediately — no login needed
loadWords();

// Load and wire dictionary source preference
chrome.storage.local.get("preferredSource", (data) => {
  if (data.preferredSource) {
    dictSourceSelect.value = data.preferredSource;
  }
});
dictSourceSelect.addEventListener("change", () => {
  chrome.storage.local.set({ preferredSource: dictSourceSelect.value });
});

// Listen for updates from background script (context menu saves)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "WORDS_UPDATED") {
    loadWords();
  }
});

// Add word form submission
addWordForm.onsubmit = (e) => {
  e.preventDefault();
  const inputValue = addWordInput.value.trim().toLowerCase();

  wordExist.style.display = "none";
  addWordInput.style.borderColor = "rgba(255, 255, 255, 0.3)";

  if (!inputValue) return;

  // Check if the word already exists
  const exists = allWords.some((w) => w.name === inputValue);
  if (exists) {
    addWordInput.style.borderColor = "#e53e3e";
    wordExist.textContent = "This word already exists";
    wordExist.style.display = "block";
    return;
  }

  // Add word locally
  const newWord = {
    _id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    name: inputValue,
    createdAt: new Date().toISOString(),
  };

  allWords.unshift(newWord);
  saveWords(allWords).then(() => {
    addWordInput.value = "";
    renderWords(getFilteredWords());
  });
};

// Search functionality
searchInput.addEventListener("input", () => {
  renderWords(getFilteredWords());
});

// Sort functionality
sortSelect.addEventListener("change", () => {
  renderWords(getFilteredWords());
});

// Export dropdown toggle
const exportDropdown = document.querySelector("#export-dropdown");
const exportJsonBtn = document.querySelector("#export-json");
const exportAnkiBtn = document.querySelector("#export-anki");

exportBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  exportDropdown.classList.toggle("show");
});

// Close dropdown on outside click
document.addEventListener("click", () => {
  exportDropdown.classList.remove("show");
});

// Export as JSON
exportJsonBtn.addEventListener("click", () => {
  exportDropdown.classList.remove("show");
  const dataStr = JSON.stringify(allWords, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `myvocabs-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Export as Anki CSV (tab-separated: front=word, back=meaning + example)
exportAnkiBtn.addEventListener("click", () => {
  exportDropdown.classList.remove("show");
  if (allWords.length === 0) return;

  let csv = "";
  allWords.forEach((word) => {
    const front = escapeCsvField(word.name);
    let back = word.definition || "";
    if (!back) back = "(no definition saved)";
    back = escapeCsvField(back);
    csv += front + "\t" + back + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `myvocabs-anki-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// Escape field for tab-separated CSV
function escapeCsvField(str) {
  // Replace tabs and newlines with spaces, quotes get doubled
  return str.replace(/\t/g, " ").replace(/\n/g, " ").replace(/\r/g, "");
}

// Import words from JSON
importBtn.addEventListener("click", () => {
  importFile.click();
});

importFile.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      if (!Array.isArray(imported)) {
        alert("Invalid file format. Expected a JSON array of words.");
        return;
      }

      let addedCount = 0;
      imported.forEach((item) => {
        const name = (item.name || item).toString().trim().toLowerCase();
        if (name && !allWords.some((w) => w.name === name)) {
          allWords.unshift({
            _id:
              Date.now().toString(36) +
              Math.random().toString(36).substr(2, 5),
            name: name,
            createdAt: item.createdAt || new Date().toISOString(),
          });
          addedCount++;
        }
      });

      saveWords(allWords).then(() => {
        renderWords(getFilteredWords());
        wordExist.textContent = `Imported ${addedCount} new word${addedCount !== 1 ? "s" : ""}`;
        wordExist.style.display = "block";
        wordExist.style.color = "#38a169";
        setTimeout(() => {
          wordExist.style.display = "none";
          wordExist.style.color = "";
        }, 3000);
      });
    } catch (err) {
      alert("Error reading file. Please make sure it's a valid JSON file.");
    }
  };
  reader.readAsText(file);
  // Reset input so the same file can be re-imported
  importFile.value = "";
});

// Get filtered and sorted words
function getFilteredWords() {
  let words = [...allWords];

  // Filter by search
  const query = searchInput.value.trim().toLowerCase();
  if (query) {
    words = words.filter((w) => w.name.includes(query));
  }

  // Sort
  const sortBy = sortSelect.value;
  if (sortBy === "az") {
    words.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === "za") {
    words.sort((a, b) => b.name.localeCompare(a.name));
  } else {
    // "newest" — default order (already sorted by newest first)
    words.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  return words;
}

// Load words from local storage
function loadWords() {
  chrome.storage.local.get("words", function (data) {
    allWords = data.words || [];
    showContent();
    renderWords(getFilteredWords());
  });
}

// Save words to local storage
function saveWords(words) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ words: words }, resolve);
  });
}

// Render words on the UI
function renderWords(words) {
  con_words.innerHTML = "";
  updateWordCount(allWords.length);

  if (allWords.length === 0) {
    showNoWordsUI();
    return;
  }

  hideNoWordsUI();

  if (words.length === 0) {
    // Search returned no results
    const noResults = document.createElement("div");
    noResults.className = "no-search-results";
    noResults.textContent = "No words match your search.";
    con_words.appendChild(noResults);
    return;
  }

  words.forEach((word) => {
    renderWord(word);
  });
}

// Render a single word card
function renderWord(word) {
  const conWord = document.createElement("div");
  conWord.classList.add("conWord");

  const textWrap = document.createElement("div");
  textWrap.classList.add("word-info");

  const text = document.createElement("div");
  text.classList.add("word");
  text.innerText = word.name;
  textWrap.appendChild(text);

  if (word.definition) {
    const defEl = document.createElement("div");
    defEl.classList.add("word-def-preview");
    defEl.textContent = word.definition.length > 80
      ? word.definition.substring(0, 80) + "…"
      : word.definition;
    textWrap.appendChild(defEl);
  }

  conWord.appendChild(textWrap);

  const dateSpan = document.createElement("div");
  dateSpan.classList.add("word-date");
  const d = new Date(word.createdAt);
  dateSpan.textContent = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  conWord.appendChild(dateSpan);

  const deleteButton = document.createElement("div");
  deleteButton.classList.add("deleteButton");
  deleteButton.title = "Delete Word";

  const deleteImg = document.createElement("img");
  deleteImg.src = "images/trash.svg";
  deleteImg.alt = "Delete";
  deleteButton.appendChild(deleteImg);
  conWord.appendChild(deleteButton);

  con_words.appendChild(conWord);

  deleteButton.onclick = () => {
    conWord.classList.add("removing");
    setTimeout(() => {
      allWords = allWords.filter((w) => w._id !== word._id);
      saveWords(allWords).then(() => {
        renderWords(getFilteredWords());
      });
    }, 300);
  };
}

// UI state helpers
function showContent() {
  content.style.display = "flex";
  loading.style.display = "none";
  error.style.display = "none";
}

function showNoWordsUI() {
  noWordsMessage.style.display = "block";
  updateWordCount(0);
}

function hideNoWordsUI() {
  noWordsMessage.style.display = "none";
}

function updateWordCount(count) {
  wordCountElement.textContent = count;
}
