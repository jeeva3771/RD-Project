import { deleteFromR2, downloadFromR2, generateSignedUrl, uploadToR2 } from "../../helpers/r2helper.js";


export const deleteImage = async (req, res) => {
  const { url } = req.body;

  try {
    await deleteFromR2(url);
    res.json({ success: true, message: "Image deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete image", error: err.message });
  }
};

export const viewImage = async (req, res) => {
  const url = req.query.url;
  try {
    if (!url) return res.status(400).send("URL is required");
    const signedUrl = generateSignedUrl(url, 3600, false);
    res.redirect(signedUrl);
  } catch {
    res.status(500).send("Error generating view link");
  }
};

export const downloadImage = async (req, res) => {
  const url = req.query.url;
  const filename = req.query.filename || "document.pdf";

  try {
    const fileData = await downloadFromR2(url);
    if (!fileData) {
      return res.status(404).json({ success: false, message: "File data not found in storage" });
    }
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(fileData);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to download image", error: err.message });
  }
};

export const uploadTest = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const uploadedFiles = await Promise.all(
      req.files.map(async (file) => {
        const imageUrl = await uploadToR2(
          "uploads",
          file.buffer,
          file.originalname,
          file.mimetype
        );

        const signedUrl = generateSignedUrl(imageUrl, 86400); // 24 hours

        return {
          imageUrl,
          signedUrl,
          originalName: file.originalname,
        };
      })
    );

    console.log('Images uploaded to R2:', uploadedFiles);

    res.status(200).json({
      success: true,
      message: 'Images uploaded successfully',
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Error uploading images:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading images',
      error: error.message,
    });
  }
};


