import express from "express";

import { requireSignIn } from "../../middleware/authMiddleware.js";
import { createBOM, deleteBOM, downloadJobSheetPDF, downloadQuotationPDF, getAllBOMs, getBOMById, updateBOM, saveBOMDraft } from "../../controllers/standalone_bom/bomController.js";
import upload from "../../middleware/multer.js";

const router = express.Router();

router.post("/downloadquote", requireSignIn, upload.single("image"), downloadQuotationPDF);

router.post("/downloadjobsheet", requireSignIn, upload.single("image"), downloadJobSheetPDF);


router.get("/", requireSignIn, getAllBOMs);
router.post(
    "/save-draft",
    requireSignIn,
    upload.fields([
        { name: "artwork_pdf", maxCount: 1 },
        { name: "artwork_cdr", maxCount: 1 },
        { name: "image", maxCount: 1 },
    ]),
    saveBOMDraft
);

router.get("/:id", requireSignIn, getBOMById);

router.post(
  "/",
  requireSignIn,
  upload.fields([
    { name: "artwork_pdf", maxCount: 1 },
    { name: "artwork_cdr", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  createBOM
);

router.put(
  "/:id",
  requireSignIn,
  upload.fields([
    { name: "artwork_pdf", maxCount: 1 },
    { name: "artwork_cdr", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  updateBOM
);

router.delete("/:id", requireSignIn, deleteBOM);



export default router;