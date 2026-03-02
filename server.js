require("dotenv").config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.static("public")); // keep serving frontend

const upload = multer({ dest: "uploads/" });
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const GFPGAN_MODEL = "tencentarc/gfpgan";
const GFPGAN_VERSION =
  process.env.REPLICATE_GFPGAN_VERSION ||
  "0fbacf7afc6c144e5be9767cff80f25aff23e52b0708f17e20f9879b2f21516c";

const replicateHeaders = {
  Authorization: `Token ${REPLICATE_API_TOKEN}`,
  "Content-Type": "application/json",
};

app.post("/upscale", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Image file is required" });
  }

  if (!REPLICATE_API_TOKEN) {
    return res.status(500).json({ error: "Missing REPLICATE_API_TOKEN" });
  }

  const scale = Number(req.body?.scale) === 4 ? 4 : 2;

  try {
    const imageData = fs.readFileSync(req.file.path, { encoding: "base64" });
    const image = `data:${req.file.mimetype};base64,${imageData}`;

    let endpointFallbackUsed = false;
    const createPrediction = async (input) => {
      try {
        return await axios.post(
          `https://api.replicate.com/v1/models/${GFPGAN_MODEL}/predictions`,
          { input },
          { headers: replicateHeaders },
        );
      } catch (createErr) {
        if (createErr.response?.status !== 404) {
          throw createErr;
        }

        endpointFallbackUsed = true;
        return axios.post(
          "https://api.replicate.com/v1/predictions",
          { version: GFPGAN_VERSION, input },
          { headers: replicateHeaders },
        );
      }
    };

    const pollPrediction = async (initialPrediction) => {
      let prediction = initialPrediction;
      const maxPollAttempts = 90; // about 3 minutes at 2s/poll
      let pollAttempts = 0;

      while (
        prediction.status !== "succeeded" &&
        prediction.status !== "failed" &&
        prediction.status !== "canceled" &&
        pollAttempts < maxPollAttempts
      ) {
        pollAttempts += 1;
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const pollResponse = await axios.get(
          `https://api.replicate.com/v1/predictions/${prediction.id}`,
          { headers: replicateHeaders },
        );

        prediction = pollResponse.data;
      }

      return { prediction, pollAttempts, maxPollAttempts };
    };

    let compatibilityFallbackUsed = false;

    const primaryCreate = await createPrediction({
      img: image,
      scale,
      version: "v1.4",
    });
    let { prediction, pollAttempts, maxPollAttempts } = await pollPrediction(
      primaryCreate.data,
    );

    const shouldRetryWithAlternateInput =
      prediction.status === "failed" &&
      typeof prediction.error === "string" &&
      prediction.error.toLowerCase().includes("out_path");

    if (shouldRetryWithAlternateInput) {
      compatibilityFallbackUsed = true;
      const fallbackCreate = await createPrediction({
        image,
        scale,
      });
      const fallbackResult = await pollPrediction(fallbackCreate.data);
      prediction = fallbackResult.prediction;
      pollAttempts = fallbackResult.pollAttempts;
      maxPollAttempts = fallbackResult.maxPollAttempts;
    }

    if (prediction.status === "succeeded") {
      const output = Array.isArray(prediction.output)
        ? prediction.output[0]
        : prediction.output;

      if (!output) {
        return res.status(500).json({ error: "Model returned no output URL" });
      }

      return res.json({ output, compatibilityFallbackUsed, endpointFallbackUsed });
    }

    if (pollAttempts >= maxPollAttempts) {
      return res.status(504).json({ error: "Upscaling timed out" });
    }

    return res.status(500).json({
      error: prediction.error || "Upscaling failed",
      status: prediction.status,
    });
  } catch (err) {
    const upstreamMessage =
      err.response?.data?.detail ||
      err.response?.data?.error ||
      err.response?.data?.title ||
      err.message ||
      "Server error";

    const statusCode = err.response?.status === 402 ? 402 : 500;
    return res.status(statusCode).json({ error: upstreamMessage });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

const port = Number(process.env.PORT) || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
