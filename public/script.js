const uploadBox = document.getElementById("uploadBox");
const imageInput = document.getElementById("imageInput");
const preview = document.getElementById("preview");
const controls = document.getElementById("controls");
const upscaleBtn = document.getElementById("upscaleBtn");
const loader = document.getElementById("loader");
const result = document.getElementById("result");
const downloadBtn = document.getElementById("downloadBtn");
const scaleButtons = document.querySelectorAll(".scale-btn");

let selectedFile = null;
let scale = 2;

// Upload click
uploadBox.addEventListener("click", () => imageInput.click());

imageInput.addEventListener("change", (e) => {
  handleFile(e.target.files[0]);
});

// Scale toggle
scaleButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    scaleButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    scale = Number(btn.dataset.scale);
  });
});

// Drag and drop support for the upload area.
uploadBox.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadBox.classList.add("drag-over");
});

uploadBox.addEventListener("dragleave", () => {
  uploadBox.classList.remove("drag-over");
});

uploadBox.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadBox.classList.remove("drag-over");
  handleFile(e.dataTransfer.files[0]);
});

upscaleBtn.addEventListener("click", async () => {
  if (!selectedFile) {
    return;
  }

  const formData = new FormData();
  formData.append("image", selectedFile);
  formData.append("scale", String(scale));

  loader.classList.remove("hidden");
  upscaleBtn.disabled = true;
  result.classList.add("hidden");
  downloadBtn.classList.add("hidden");

  try {
    const response = await fetch("/upscale", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Upscale request failed");
    }

    result.src = data.output;
    result.classList.remove("hidden");
    downloadBtn.href = data.output;
    downloadBtn.classList.remove("hidden");
  } catch (error) {
    console.error(error);
    alert(error.message || "Something went wrong while upscaling.");
  } finally {
    loader.classList.add("hidden");
    upscaleBtn.disabled = false;
  }
});

function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    return;
  }

  selectedFile = file;

  const reader = new FileReader();
  reader.onload = () => {
    preview.src = reader.result;
    preview.classList.remove("hidden");
    controls.classList.remove("hidden");
    result.classList.add("hidden");
    downloadBtn.classList.add("hidden");
  };
  reader.readAsDataURL(selectedFile);
}
