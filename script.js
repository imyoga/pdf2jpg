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
const resetButton = document.getElementById("resetButton");
const dpiInfoButton = document.getElementById("dpiInfoButton");
const dpiModal = document.getElementById("dpiModal");
const modalOkButton = document.getElementById("modalOkButton");

// Modal functions
function openModal() {
  dpiModal.classList.add('show');
  modalOkButton.focus();
}

function closeModal() {
  dpiModal.classList.remove('show');
}

// Event listeners for modal
dpiInfoButton.addEventListener("click", openModal);
modalOkButton.addEventListener("click", closeModal);

// Close modal when clicking outside
window.addEventListener("click", (event) => {
  if (event.target === dpiModal) {
    closeModal();
  }
});

// Close modal with Escape key
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && dpiModal.classList.contains('show')) {
    closeModal();
  }
});

// Function to reset the application state
function resetApplication() {
  // Clear file input
  fileInput.value = '';
  fileName.textContent = '';
  
  // Reset buttons
  convertButton.disabled = true;
  downloadButton.disabled = true;
  
  // Reset progress bar
  progressBar.style.width = "0%";
  
  // Clear images array
  images = [];
  
  // Reset DPI selection to 150
  const defaultDPI = document.querySelector('input[name="dpi"][value="150"]');
  if (defaultDPI) defaultDPI.checked = true;
  
  // Reset upload area styles
  uploadArea.style.borderColor = "#ff8a00";
  uploadArea.style.background = "transparent";
}

// Add reset button event listener
resetButton.addEventListener("click", resetApplication);

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
    downloadButton.disabled = true;
  }
});

// File input change handler
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) {
    fileName.textContent = file.name;
    convertButton.disabled = false;
    downloadButton.disabled = true;
  }
});

// Add event listeners for convert and download buttons
convertButton.addEventListener("click", convertPdfToJpg);
downloadButton.addEventListener("click", downloadJPGsAsZip);

// Add event listeners for DPI radio buttons
document.querySelectorAll('input[name="dpi"]').forEach(radio => {
  radio.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      convertButton.disabled = false;
      downloadButton.disabled = true;
      images = []; // Clear previous converted images
      progressBar.style.width = "0%"; // Reset progress bar when DPI changes
    }
  });
});

// Function to get the selected DPI value
function getSelectedDPI() {
  const selectedDPI = document.querySelector('input[name="dpi"]:checked');
  return selectedDPI ? parseInt(selectedDPI.value) : 150; // Default to 150 if none selected
}

// Function to calculate scale based on DPI
function calculateScale(dpi) {
  // Base scale is 96 DPI (standard screen resolution)
  return dpi / 96;
}

// Function to convert the PDF to JPG
async function convertPdfToJpg() {
  const file = fileInput.files[0];
  if (!file) return;

  // Disable buttons during conversion
  convertButton.disabled = true;
  downloadButton.disabled = true;

  // Reset progress bar
  progressBar.style.width = "0%";

  // Create a file reader to read the file
  const fileReader = new FileReader();

  fileReader.onload = async function () {
    const typedArray = new Uint8Array(this.result);

    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.1.81/pdf.worker.min.js";

    try {
      const pdf = await pdfjsLib.getDocument(typedArray).promise;
      images = [];

      // Get selected DPI and calculate scale
      const dpi = getSelectedDPI();
      const scale = calculateScale(dpi);

      // Update progress bar max value
      const totalPages = pdf.numPages;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: scale });

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

      // Enable download button after conversion
      downloadButton.disabled = false;
      
      // Keep progress bar at 100% after conversion
      progressBar.style.width = "100%";

    } catch (error) {
      console.error("Error converting PDF:", error);
      convertButton.disabled = false;
      downloadButton.disabled = true;
      progressBar.style.width = "0%"; // Reset progress bar on error
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
