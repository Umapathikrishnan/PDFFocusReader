// <!-- Load the pdf.js library as a module -->
import * as pdfjsLib from "https://mozilla.github.io/pdf.js/build/pdf.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://mozilla.github.io/pdf.js/build/pdf.worker.mjs";

// --- DOM Elements ---
const fileInput = document.getElementById("file-input");
const box = document.getElementById("box");

const pageIndicator = document.getElementById("page-indicator");
const currentPageNum = document.getElementById("current-page-num");

// Buttons
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const continueBtn = document.getElementById("continue-btn");
const resetBtn = document.getElementById("reset-btn");
const updateRangeBtn = document.getElementById("update-range-btn");

// Controls
const wpmSelect = document.getElementById("wpm-select");
const customWpmInput = document.getElementById("custom-wpm");
const fontSelect = document.getElementById("font-select");
const startPageInput = document.getElementById("start-page");
const endPageInput = document.getElementById("end-page");
const themeToggle = document.getElementById("theme-toggle");
const paletteSwatches = document.querySelectorAll(".palette-swatch");
const customPaletteBtn = document.getElementById("custom-palette-btn");
const customColorsDiv = document.getElementById("custom-colors");
const textColorInput = document.getElementById("text-color");
const bgColorInput = document.getElementById("bg-color");

// --- State Variables ---
let outputText = ""; 
let timer;
let isReading = false;
let currentWordIndex = 0;
let words = [];
let wordPageMapping = []; // Tracks page number for each word index
let loadedFile = null; 

// Initial Setup
const dummyText = "Results will appear here. Please select a PDF file.";
box.textContent = dummyText;

// --- Event Listeners ---

// 1. File Input
fileInput.addEventListener("change", (event) => {
  loadedFile = event.target.files[0];
  if (loadedFile && loadedFile.type === "application/pdf") {
    startPageInput.value = "";
    endPageInput.value = ""; 
    readPDF(loadedFile);
  } else {
    box.textContent = "Please select a valid PDF file.";
  }
});

// 2. Reading Control Logic
startBtn.addEventListener("click", () => {
    if (!validatePDFLoaded()) return;
    resetReaderState(); 
    // parseWords(); // REMOVED: words are now parsed in readPDF to ensure mapping validity
    startReadingLoop();
    updateButtonVisibility("reading");
});

pauseBtn.addEventListener("click", () => {
    stopReadingInterval();
    updateButtonVisibility("paused");
});

continueBtn.addEventListener("click", () => {
    if (!validatePDFLoaded()) return;
    startReadingLoop();
    updateButtonVisibility("reading");
});

resetBtn.addEventListener("click", () => {
    stopReadingInterval();
    resetReaderState();
    box.textContent = words.length > 0 ? "Reset. Ready to start." : dummyText;
    currentWordIndex = 0;
    updatePageIndicator("-");
    updateButtonVisibility("stopped");
});

updateRangeBtn.addEventListener("click", () => {
    if (loadedFile) {
        readPDF(loadedFile);
    } else {
        alert("Please load a PDF first.");
    }
});


// 3. WPM Selection
wpmSelect.addEventListener("change", (e) => {
    if (e.target.value === "custom") {
        customWpmInput.style.display = "inline-block";
        customWpmInput.focus();
    } else {
        customWpmInput.style.display = "none";
        // If reading, update speed immediately
        if (isReading) {
            stopReadingInterval();
            startReadingLoop();
        }
    }
});

customWpmInput.addEventListener("change", () => {
     if (isReading) {
            stopReadingInterval();
            startReadingLoop();
        }
});

// 4. Font Selection
fontSelect.addEventListener("change", (e) => {
    box.style.fontFamily = e.target.value;
});

// 5. Color Palettes
paletteSwatches.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    paletteSwatches.forEach((s) => s.classList.remove("active"));
    swatch.classList.add("active");

    if (swatch.id === "custom-palette-btn") {
      customColorsDiv.style.display = "flex";
      box.style.color = textColorInput.value;
      box.style.backgroundColor = bgColorInput.value;
    } else {
      customColorsDiv.style.display = "none";
      const bg = swatch.dataset.bg;
      const text = swatch.dataset.text;
      box.style.backgroundColor = bg;
      box.style.color = text;
      textColorInput.value = text;
      bgColorInput.value = bg;
    }
  });
});

// 6. Custom Color Inputs
textColorInput.addEventListener("input", (e) => {
  box.style.color = e.target.value;
});
bgColorInput.addEventListener("input", (e) => {
  box.style.backgroundColor = e.target.value;
});

// 7. Theme Toggle
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("light-mode");
  const isLight = document.body.classList.contains("light-mode");
  themeToggle.textContent = isLight ? "Dark Mode" : "Light Mode";
});

// --- Helper Functions ---

function validatePDFLoaded() {
  if (words.length === 0) {
    alert("Please load a PDF first!");
    return false;
  }
  return true;
}

// Deprecated in favor of direct extraction in readPDF
// function parseWords() { ... } 

function resetReaderState() {
  currentWordIndex = 0;
  isReading = false;
}

function stopReadingInterval() {
  clearInterval(timer);
  isReading = false;
}

function getWPM() {
  let val = wpmSelect.value;
  if (val === "custom") {
    return parseInt(customWpmInput.value) || 200;
  }
  return parseInt(val);
}

function updatePageIndicator(pageNum) {
    if (pageNum) {
        pageIndicator.style.display = "block";
        currentPageNum.textContent = pageNum;
    } else {
         pageIndicator.style.display = "none";
    }
}

function startReadingLoop() {
  if (words.length === 0) return;

  isReading = true;
  const wpm = getWPM();
  const intervalMs = 60000 / wpm;

  console.log(`Reading at ${wpm} WPM`);
  
  // Show initial page
  if (currentWordIndex < wordPageMapping.length) {
      updatePageIndicator(wordPageMapping[currentWordIndex]);
  }

  timer = setInterval(() => {
    if (currentWordIndex < words.length) {
      box.textContent = words[currentWordIndex];
      // Update page number
      const pageNum = wordPageMapping[currentWordIndex];
      if (pageNum) updatePageIndicator(pageNum);
      
      currentWordIndex++;
    } else {
      stopReadingInterval();
      box.textContent = "Finished Reading.";
      updateButtonVisibility("stopped");
    }
  }, intervalMs);
}

function updateButtonVisibility(state) {
  startBtn.style.display = "none";
  pauseBtn.style.display = "none";
  continueBtn.style.display = "none";
  resetBtn.style.display = "inline-block";

  if (state === "stopped") {
    startBtn.style.display = "inline-block";
  } else if (state === "reading") {
    pauseBtn.style.display = "inline-block";
  } else if (state === "paused") {
    continueBtn.style.display = "inline-block";
  }
}

// Function to read the PDF and extract text
async function readPDF(file) {
  box.textContent = "Extracting text... (This may take a moment for mapping)";
  
  // Clear previous data
  words = [];
  wordPageMapping = [];
  outputText = "";

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;

    let startPage = parseInt(startPageInput.value) || 1;
    let endPage = parseInt(endPageInput.value) || totalPages;

    if (startPage < 1) startPage = 1;
    if (endPage > totalPages) endPage = totalPages;
    if (startPage > endPage) {
        alert("Invalid Page Range! Defaulting to all pages.");
        startPage = 1;
        endPage = totalPages;
    }

    startPageInput.value = startPage;
    endPageInput.value = endPage;

    for (let i = startPage; i <= endPage; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((s) => s.str).join(" ");
        
        // Tokenize per page
        const pageWords = pageText.replace(/\s+/g, ' ').split(" ").filter(w => w.length > 0);
        
        if (pageWords.length > 0) {
            words.push(...pageWords);
            // push page number for every word in this page
            for(let k=0; k < pageWords.length; k++){
                wordPageMapping.push(i);
            }
        }
        
        outputText += pageText + " ";
    }

    box.textContent = `PDF Loaded (Pages ${startPage}-${endPage})! Click Start to read.`;
    console.log("Total words:", words.length);

    stopReadingInterval();
    resetReaderState();
    updateButtonVisibility("stopped");
    updatePageIndicator("-"); // reset indicator

  } catch (error) {
    console.error(error);
    box.textContent = "Error extracting PDF text: " + error.message;
  }
}
