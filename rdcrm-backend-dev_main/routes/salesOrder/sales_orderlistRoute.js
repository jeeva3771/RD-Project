import express from "express";
import {
  getAllSampleOrders,
  getSampleOrderById,
  updateSampleOrder,
  deleteSampleOrder,
  sendPIEmailById,
  sendQuotationEmailById,
  updateSampleOrderBOM,
  deleteAdditionalFile,
  sendDtpEmailById,
  sendDtpWhatsAppById
} from "../../controllers/salesOrder/salesOrderlistController.js";


import { requireSignIn } from "../../middleware/authMiddleware.js";
import upload from "../../middleware/multer.js";


const router = express.Router();

/**
 * @swagger
 * /sampleorderlist/mail/{id}:
 *   get:
 *     summary: Send PI (Proforma Invoice) email by order ID
 *     tags: [Sample Order]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Sample order ID
 *     responses:
 *       200:
 *         description: Email sent successfully
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
 *         description: Order not found
 *       500:
 *         description: Server error
 */
router.get("/mail/:id", sendPIEmailById);

/**
 * @swagger
 * /sampleorderlist/quotationmail/{id}:
 *   get:
 *     summary: Send quotation email by order ID
 *     tags: [Sample Order]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Sample order ID
 *     responses:
 *       200:
 *         description: Email sent successfully
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
 *         description: Order not found
 *       500:
 *         description: Server error
 */
router.get("/quotationmail/:id", sendQuotationEmailById);

/**
 * @swagger
 * /sampleorderlist/dtpmail/{id}:
 *   get:
 *     summary: Send DTP email by order ID
 *     tags: [Sample Order]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Sample order ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Type of share (master/proofing)
 *       - in: query
 *         name: dtpId
 *         schema:
 *           type: string
 *         description: DTP Job ID
 *     responses:
 *       200:
 *         description: Email sent successfully
 *       404:
 *         description: Order not found
 *       500:
 *         description: Server error
 */
router.get("/dtpmail/:id", sendDtpEmailById);
router.post("/dtpwhatsapp/:id", sendDtpWhatsAppById);

/**
 * @swagger
 * /sampleorderlist:
 *   get:
 *     summary: Get all sample orders
 *     tags: [Sample Order]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by order status
 *       - in: query
 *         name: customer_id
 *         schema:
 *           type: string
 *         description: Filter by customer ID
 *     responses:
 *       200:
 *         description: List of sample orders retrieved successfully
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
router.get("/", requireSignIn, getAllSampleOrders);

/**
 * @swagger
 * /sampleorderlist/{id}:
 *   get:
 *     summary: Get sample order by ID
 *     tags: [Sample Order]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Sample order ID
 *     responses:
 *       200:
 *         description: Sample order retrieved successfully
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
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/:id", requireSignIn, getSampleOrderById);

// router.post("/", requireSignIn, upload.single("image"), createSampleOrder);

/**
 * @swagger
 * /sampleorderlist/{id}:
 *   put:
 *     summary: Update sample order by ID
 *     tags: [Sample Order]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Sample order ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               designer_files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Designer files (max 1000)
 *               pi_files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: PI files (max 1000)
 *               status:
 *                 type: string
 *               customer_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sample order updated successfully
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
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put("/:id", upload.any(), requireSignIn, updateSampleOrder);

/**
 * @swagger
 * /sampleorderlist/clientscreen/{csid}:
 *   put:
 *     summary: Update sample order BOM
 *     tags: [Sample Order]
 *     parameters:
 *       - in: path
 *         name: csid
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer sample ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bom_data:
 *                 type: object
 *                 description: BOM data to update
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
 *       404:
 *         description: Order not found
 *       500:
 *         description: Server error
 */
router.put("/clientscreen/:csid", upload.any(), updateSampleOrderBOM);

/**
 * @swagger
 * /sampleorderlist/{id}:
 *   delete:
 *     summary: Delete sample order by ID
 *     tags: [Sample Order]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Sample order ID
 *     responses:
 *       200:
 *         description: Sample order deleted successfully
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
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.delete("/:id", requireSignIn, deleteSampleOrder);

/**
 * @swagger
 * /sampleorderlist/{id}/delete-file:
 *   post:
 *     summary: Delete additional file from sample order
 *     tags: [Sample Order]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               file_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: File deleted successfully
 */
router.post("/:id/delete-file", requireSignIn, deleteAdditionalFile);

export default router;

