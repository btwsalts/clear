const uploadBox = document.getElementById("uploadBox");
const imageInput = document.getElementById("imageInput");
const uploadHint = document.getElementById("uploadHint");
const statusText = document.getElementById("statusText");
const preview = document.getElementById("preview");
const previewEmpty = document.getElementById("previewEmpty");
const controls = document.getElementById("controls");
const upscaleBtn = document.getElementById("upscaleBtn");
const loader = document.getElementById("loader");
const result = document.getElementById("result");
const resultEmpty = document.getElementById("resultEmpty");
const downloadBtn = document.getElementById("downloadBtn");
const scaleButtons = document.querySelectorAll(".scale-btn");

let selectedFile = null;
let scale = 2;

window.addEventListener("load", () => {
  const splash = document.getElementById("splash");
  if (!splash) {
    return;
  }

  setTimeout(() => {
    splash.classList.add("splash-exit");
    document.body.classList.remove("is-loading");

    setTimeout(() => {
      splash.remove();
    }, 320);
  }, 3000);
});

uploadBox.addEventListener("click", () => imageInput.click());

imageInput.addEventListener("change", (e) => {
  handleFile(e.target.files[0]);
});

scaleButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    scaleButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    scale = Number(btn.dataset.scale);
  });
});

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

downloadBtn.addEventListener("click", async (e) => {
  e.preventDefault();

  const imageUrl = downloadBtn.href || result.src;
  if (!imageUrl) {
    return;
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error("Failed to download image");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const tempLink = document.createElement("a");
    tempLink.href = objectUrl;
    tempLink.download = "upscaled.png";
    document.body.appendChild(tempLink);
    tempLink.click();
    tempLink.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    console.error(error);
    window.location.href = imageUrl;
  }
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
  upscaleBtn.textContent = "Upscaling...";
  result.classList.add("hidden");
  downloadBtn.classList.add("hidden");
  if (resultEmpty) {
    resultEmpty.classList.remove("hidden");
    resultEmpty.textContent = "Generating your upscaled image...";
  }
  if (statusText) {
    statusText.textContent = "Working on your image...";
  }

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
    if (resultEmpty) {
      resultEmpty.classList.add("hidden");
    }
    if (statusText) {
      statusText.textContent = data.compatibilityFallbackUsed
        ? "First attempt failed on the model side, but compatibility retry succeeded. You can download the result now."
        : "Done. You can download the result now.";
    }
  } catch (error) {
    console.error(error);
    if (resultEmpty) {
      resultEmpty.classList.remove("hidden");
      resultEmpty.textContent = "Upscaling failed. Try another image.";
    }
    if (statusText) {
      statusText.textContent = "Something went wrong while upscaling.";
    }
    alert(error.message || "Something went wrong while upscaling.");
  } finally {
    loader.classList.add("hidden");
    upscaleBtn.disabled = false;
    upscaleBtn.textContent = "Upscale Image";
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

    if (previewEmpty) {
      previewEmpty.classList.add("hidden");
    }
    if (resultEmpty) {
      resultEmpty.classList.remove("hidden");
      resultEmpty.textContent = "Upscaled output appears here.";
    }
    if (uploadHint) {
      uploadHint.textContent = file.name;
    }
    if (statusText) {
      statusText.textContent = "Image selected. Choose scale and upscale.";
    }
  };
  reader.readAsDataURL(selectedFile);
}
