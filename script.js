// <!-- Load the pdf.js library as a module -->
import * as pdfjsLib from "https://mozilla.github.io/pdf.js/build/pdf.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://mozilla.github.io/pdf.js/build/pdf.worker.mjs";

// Reference the HTML elements
const fileInput = document.getElementById("file-input");
const outputEl = document.getElementById("output");
let outputText = "";

// Add event listener to the file input
fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file && file.type === "application/pdf") {
    readPDF(file);
  } else {
    outputEl.textContent = "Please select a valid PDF file.";
  }
});

// Function to read the PDF and extract text
async function readPDF(file) {
  outputEl.textContent = "Extracting text...";
  try {
    // Use FileReader to read the local file as an ArrayBuffer
    const arrayBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });

    // Load the PDF document
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    let fullText = "";

    // Iterate through all pages
    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((s) => s.str).join(" ");
      fullText += pageText + "\n\n";
    }

    outputEl.textContent = fullText;
    outputText = fullText;
  } catch (error) {
    console.error(error);
    outputEl.textContent = "Error extracting PDF text: " + error.message;
  }
}

//text switch for words per min reading
const box = document.getElementById("box");
const start = document.getElementById("start");
console.log("Script loaded", start);

let dummyText =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

start.addEventListener("click", () => {
  console.log("Started");
  let words = outputText.split(" ");
  console.log(words);
  let index = 0;
  let wpm = 200;
  let interval = 60000 / wpm;
  box.innerText = "";
  let timer = setInterval(() => {
    console.log("Interval tick");
    if (index < words.length) {
      box.innerText = words[index];
      index++;
    } else {
      clearInterval(timer);
    }
  }, interval);
});

const stop = document.getElementById("stop");
stop.addEventListener("click", () => {
  box.innerText = "";
});
