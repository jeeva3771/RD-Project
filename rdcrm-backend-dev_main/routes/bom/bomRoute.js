import express from "express";

import { requireSignIn } from "../../middleware/authMiddleware.js";
import { createBOM, deleteBOM, downloadJobSheetPDF, downloadQuotationPDF, getAllBOMs, getBOMById, saveBOMDraft, updateBOM, approveBOMQtyUpdate } from "../../controllers/bom/bomController.js";
import upload from "../../middleware/multer.js";

const router = express.Router();

/**
 * @swagger
 * /bom/downloadquote:
 *   post:
 *     summary: Download quotation PDF
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bom_id:
 *                 type: string
 *                 description: BOM ID to generate quotation PDF
 *     responses:
 *       200:
 *         description: PDF generated successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/downloadquote", requireSignIn, downloadQuotationPDF);

// Save BOM as Draft (upsert — no duplicates)
router.post(
  "/savedraft",
  requireSignIn,
  upload.fields([
    { name: "artwork_pdf", maxCount: 1 },
    { name: "artwork_cdr", maxCount: 1 },
  ]),
  saveBOMDraft
);

/**
 * @swagger
 * /bom/downloadjobsheet:
 *   post:
 *     summary: Download job sheet PDF
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bom_id:
 *                 type: string
 *                 description: BOM ID to generate job sheet PDF
 *     responses:
 *       200:
 *         description: PDF generated successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/downloadjobsheet", requireSignIn, downloadJobSheetPDF);

/**
 * @swagger
 * /bom:
 *   get:
 *     summary: Get all BOMs
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: job_no
 *         schema:
 *           type: string
 *         description: Filter by job number
 *       - in: query
 *         name: sub_job_no
 *         schema:
 *           type: string
 *         description: Filter by sub job number
 *     responses:
 *       200:
 *         description: List of BOMs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", requireSignIn, getAllBOMs);

/**
 * @swagger
 * /bom/{id}:
 *   get:
 *     summary: Get BOM by ID
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: BOM ID
 *     responses:
 *       200:
 *         description: BOM retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       404:
 *         description: BOM not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/:id", requireSignIn, getBOMById);

/**
 * @swagger
 * /bom:
 *   post:
 *     summary: Create a new BOM
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               artwork_pdf:
 *                 type: string
 *                 format: binary
 *                 description: PDF artwork file
 *               artwork_cdr:
 *                 type: string
 *                 format: binary
 *                 description: CDR artwork file
 *               job_no:
 *                 type: string
 *               sub_job_no:
 *                 type: string
 *               materialprocess:
 *                 type: string
 *                 description: JSON string of material processes
 *     responses:
 *       201:
 *         description: BOM created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/",
  requireSignIn,
  upload.fields([
    { name: "artwork_pdf", maxCount: 1 },
    { name: "artwork_cdr", maxCount: 1 },
  ]),
  createBOM
);

/**
 * @swagger
 * /bom/{id}:
 *   put:
 *     summary: Update BOM by ID
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: BOM ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               artwork_pdf:
 *                 type: string
 *                 format: binary
 *                 description: PDF artwork file
 *               artwork_cdr:
 *                 type: string
 *                 format: binary
 *                 description: CDR artwork file
 *               materialprocess:
 *                 type: string
 *                 description: JSON string of material processes
 *     responses:
 *       200:
 *         description: BOM updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       404:
 *         description: BOM not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put(
  "/:id",
  requireSignIn,
  upload.fields([
    { name: "artwork_pdf", maxCount: 1 },
    { name: "artwork_cdr", maxCount: 1 },
  ]),
  updateBOM
);

/**
 * @swagger
 * /bom/{id}:
 *   delete:
 *     summary: Delete BOM by ID
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: BOM ID
 *     responses:
 *       200:
 *         description: BOM deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: BOM not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.delete("/:id", requireSignIn, deleteBOM);

// Route to handle roles approval (Admin/Client) of a sandboxed quantity change
router.post("/approve-qty-update/:id", requireSignIn, approveBOMQtyUpdate);

export default router;
