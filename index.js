import express from "express";
import multer from "multer";
import sharp from "sharp";
import Tesseract from "tesseract.js";
import cors from "cors";

const app = express();
app.use(cors({ origin: "http://localhost:3000" }));
// ✅ Multer Configuration (File Limits & Validation)
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(
        new Error("Invalid file type. Only JPEG, PNG, and WEBP are allowed.")
      );
    }
    cb(null, true);
  },
});

// ✅ API Endpoint for Text Extraction (Without Resizing)
app.post(
  "/api/extractTextCoordinates",
  upload.single("image"),
  async (req, res) => {
    try {
      // 🔍 1. Validate Image Upload
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          success: false,
          error: "No image uploaded. Please upload a valid image.",
        });
      }

      // 🔍 2. Convert Image to PNG (Ensures Tesseract Compatibility)
      const imageBuffer = await sharp(req.file.buffer)
        .toFormat("png")
        .toBuffer();

      // 🔍 3. Perform OCR (Extract Text & Coordinates)
      const { data } = await Tesseract.recognize(imageBuffer, "eng", {
        tessedit_ocr_engine_mode: Tesseract.OEM.DEFAULT, // Ensure it runs in recognition mode only
        tessedit_pageseg_mode: Tesseract.PSM.AUTO, // Auto-detect segmentation
      });

      // 🔍 4. Validate Extracted Text
      if (!data.text || data.text.trim() === "") {
        return res.status(400).json({
          success: false,
          error: "No readable text found in the image.",
        });
      }

      // 🔍 5. Extract Text & Bounding Boxes
      const textCoordinates = data.words.map(
        ({ text, bbox: { x0, y0, x1, y1 } }) => ({
          text,
          border: { minX: x0, minY: y0, maxX: x1, maxY: y1 },
        })
      );

      // ✅ Return Response
      res.json({ success: true, extractedText: data.text, textCoordinates });
    } catch (error) {
      console.error("Error processing image:", error.message);
      res.status(500).json({
        success: false,
        error: "Internal Server Error. Please try again later.",
      });
    }
  }
);

// ✅ Global Error Handler
app.use((err, req, res, next) => {
  console.error("Global Error:", err.message);
  res
    .status(500)
    .json({ success: false, error: err.message || "Internal Server Error" });
});

// ✅ Start Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
