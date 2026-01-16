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
const focusToggle = document.getElementById("focus-toggle"); // Focus Letter Toggle
const paletteSwatches = document.querySelectorAll(".palette-swatch");
const customPaletteBtn = document.getElementById("custom-palette-btn");
const customColorsDiv = document.getElementById("custom-colors");
const textColorInput = document.getElementById("text-color");
const bgColorInput = document.getElementById("bg-color");

// PDF Preview Elements
const previewContainer = document.getElementById("preview-container");
const canvas = document.getElementById("pdf-render");
const ctx = canvas.getContext("2d");

// --- State Variables ---
let outputText = ""; 
let timer;
let isReading = false;
let currentWordIndex = 0;
let words = [];
let wordPageMapping = []; // Tracks page number for each word index
let loadedFile = null; 
let pdfDoc = null; // Store loaded PDF document globally
let currentlyRenderedPage = 0; // State to track rendered page

// Initial Setup
const dummyText = "Results will appear here. Please select a PDF file.";
box.textContent = dummyText;

// --- Event Listeners ---

// 1. File Input
fileInput.addEventListener("change", (event) => {
  loadedFile = event.target.files[0];
  if (loadedFile && loadedFile.type === "application/pdf") {
    // Reset page inputs on new file load
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
    
    // Reset preview to start page if available
    if (wordPageMapping.length > 0) {
        renderPage(wordPageMapping[0]);
    }

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


// Manual Validation Controls
const prevPageBtn = document.getElementById("prev-page");
const nextPageBtn = document.getElementById("next-page");
const previewPageNum = document.getElementById("preview-page-num");
const totalPagesSpan = document.getElementById("total-pages");

prevPageBtn.addEventListener("click", () => {
    console.log("Prev Clicked. Current:", currentlyRenderedPage);
    if (currentlyRenderedPage <= 1) return;
    renderPage(currentlyRenderedPage - 1);
});

nextPageBtn.addEventListener("click", () => {
    console.log("Next Clicked. Current:", currentlyRenderedPage, "Total:", pdfDoc ? pdfDoc.numPages : "null");
    if (!pdfDoc || currentlyRenderedPage >= pdfDoc.numPages) return;
    renderPage(currentlyRenderedPage + 1);
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
    // Remove active class from all
    paletteSwatches.forEach((s) => s.classList.remove("active"));
    swatch.classList.add("active");

    if (swatch.id === "custom-palette-btn") {
      customColorsDiv.style.display = "flex";
      // Set box colors to current custom input values
      box.style.color = textColorInput.value;
      box.style.backgroundColor = bgColorInput.value;
    } else {
      customColorsDiv.style.display = "none";
      const bg = swatch.dataset.bg;
      const text = swatch.dataset.text;
      box.style.backgroundColor = bg;
      box.style.color = text;

      // Update custom inputs to match selection (optional ux)
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

function formatWord(word) {
    // Check if the feature is enabled
    if (!focusToggle.checked || word.length === 0) return word;
    
    // Only format if word is substantial enough? User asked for center letter.
    // If length is 1, index 0. If 2, index 0 (floor) or 1? Math.floor((2-1)/2) = 0.
    // Let's use standard center floor.
    if (word.length === 0) return word;

    const centerIndex = Math.floor((word.length - 1) / 2);
    const pre = word.substring(0, centerIndex);
    const center = word[centerIndex];
    const post = word.substring(centerIndex + 1);

    return `${pre}<span class="focus-letter">${center}</span>${post}`;
}

// Function to render PDF page
async function renderPage(num) {
    if (!pdfDoc || num === currentlyRenderedPage) return;
    
    // Validate page exists
    if (num < 1 || num > pdfDoc.numPages) return;

    try {
        currentlyRenderedPage = num;
        const page = await pdfDoc.getPage(num);
        
        // Scale to fit canvas width
        const desiredWidth = canvas.clientWidth || 600; // Fallback or current logical width
        const viewport = page.getViewport({ scale: 1.0 });
        const scale = desiredWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale: scale });

        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;

        const renderContext = {
            canvasContext: ctx,
            viewport: scaledViewport
        };
        await page.render(renderContext).promise;
        
        previewContainer.style.display = "block";
        
        // Update Page Count Display
        previewPageNum.textContent = num;
        totalPagesSpan.textContent = pdfDoc.numPages;

    } catch (err) {
        console.error("Error rendering page:", err);
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
      const pageNum = wordPageMapping[currentWordIndex];
      updatePageIndicator(pageNum);
      renderPage(pageNum); // Render initial page
  }

  timer = setInterval(() => {
    if (currentWordIndex < words.length) {
      const displayWord = formatWord(words[currentWordIndex]);
      box.innerHTML = displayWord; // Use InnerHTML for styling
      
      // Update page number
      const pageNum = wordPageMapping[currentWordIndex];
      if (pageNum) updatePageIndicator(pageNum);
      
      // Sync Preview: Render new page if changed
      if (pageNum && pageNum !== currentlyRenderedPage) {
          renderPage(pageNum);
      }
      
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
  pdfDoc = null; // Clear global PDF
  currentlyRenderedPage = 0;

  try {
    const arrayBuffer = await file.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise; // Store globally
    const totalPages = pdfDoc.numPages;

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
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((s) => s.str).join(" ");
        
        // Tokenize per page
        const pageWords = pageText.replace(/\s+/g, ' ').split(" ").filter(w => w.length > 0);
        
        if (pageWords.length > 0) {
            words.push(...pageWords);
            // push page number for every word in this page
            const actualPageNum = i; 
            for(let k=0; k < pageWords.length; k++){
                wordPageMapping.push(actualPageNum);
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
    
    // Simply show the container, but don't render until Start or if range is explicit
    previewContainer.style.display = "block";
    renderPage(startPage); 

  } catch (error) {
    console.error(error);
    box.textContent = "Error extracting PDF text: " + error.message;
  }
}
