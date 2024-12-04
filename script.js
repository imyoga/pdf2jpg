// Define images array in global scope
let images = [];

// Get DOM elements
const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("pdfFile");
const fileName = document.getElementById("fileName");
const convertButton = document.getElementById("convertButton");
const downloadButton = document.getElementById("downloadButton");
const progress = document.getElementById("progress");
const progressBar = document.getElementById("progressBar");

// Add drag and drop event listeners
uploadArea.addEventListener("click", () => fileInput.click());
uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.style.borderColor = "#ff5100";
  uploadArea.style.background = "rgba(255, 138, 0, 0.05)";
});

uploadArea.addEventListener("dragleave", (e) => {
  e.preventDefault();
  uploadArea.style.borderColor = "#ff8a00";
  uploadArea.style.background = "transparent";
});

uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.style.borderColor = "#ff8a00";
  uploadArea.style.background = "transparent";
  
  const file = e.dataTransfer.files[0];
  if (file && file.type === "application/pdf") {
    fileInput.files = e.dataTransfer.files;
    fileName.textContent = file.name;
    convertButton.disabled = false;
  }
});

// File input change handler
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) {
    fileName.textContent = file.name;
    convertButton.disabled = false;
  }
});

// Add event listeners for convert and download buttons
convertButton.addEventListener("click", convertPdfToJpg);
downloadButton.addEventListener("click", downloadJPGsAsZip);

// Function to convert the PDF to JPG
async function convertPdfToJpg() {
  const file = fileInput.files[0];
  if (!file) return;

  // Show progress bar and disable convert button
  progress.style.display = "block";
  convertButton.disabled = true;
  downloadButton.style.display = "none";

  // Create a file reader to read the file
  const fileReader = new FileReader();

  fileReader.onload = async function () {
    const typedArray = new Uint8Array(this.result);

    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.1.81/pdf.worker.min.js";

    try {
      const pdf = await pdfjsLib.getDocument(typedArray).promise;
      images = [];

      // Update progress bar max value
      const totalPages = pdf.numPages;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.5 });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        const img = document.createElement("img");
        img.src = canvas.toDataURL("image/jpeg", 0.95);

        images.push(img.src);

        // Update progress bar
        progressBar.style.width = `${(i / totalPages) * 100}%`;
      }

      // Show download button and reset progress
      downloadButton.style.display = "";
      setTimeout(() => {
        progress.style.display = "none";
        progressBar.style.width = "0%";
      }, 500);
    } catch (error) {
      console.error("Error converting PDF:", error);
      progress.style.display = "none";
      convertButton.disabled = false;
      alert("Error converting PDF. Please try again.");
    }
  };

  fileReader.readAsArrayBuffer(file);
}

// Function to download the JPGs as a ZIP file
async function downloadJPGsAsZip() {
  const zip = new JSZip();

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const filename = `page${i + 1}.jpg`;
    zip.file(filename, img.split(",")[1], { base64: true });
  }

  const content = await zip.generateAsync({ type: "blob" });

  const downloadLink = document.createElement("a");
  downloadLink.href = URL.createObjectURL(content);
  downloadLink.download = "images.zip";
  downloadLink.click();
}
