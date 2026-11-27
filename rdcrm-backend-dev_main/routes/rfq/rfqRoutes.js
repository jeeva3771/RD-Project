import express from "express";
import { requireSignIn } from "../../middleware/authMiddleware.js";
import { getAllRFQs, createRFQ, updateRFQ, getAvailableJobNos, getPackingAvailableJobs, getSubJobsForJob, getPackingSubJobsForJob, getMaterialDetails, getPackingDetails, markPackPurchased, getVendorsByMaterial, broadcastRFQ, getVendorRFQView, submitVendorQuote, sendPOEmails, getNextPoNumber, getStoreRFQPendingRequests, getStoreRFQRequestDetails, getCoordRFQs, updateCoordStage, addCoordRemark, updateCoordETA, updateInwardAccounting, updateAwardCoordStage, updateAwardCoordETA, restoreAwardCoordETA, addAwardCoordRemark, updateAwardInwardAccounting, awardInwardAction, acceptAwardQtyChange, acceptAwardDateChange } from "../../controllers/rfq/rfqController.js";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

/**
 * @swagger
 * /rfq:
 *   get:
 *     summary: Get all RFQs
 *     tags: [RFQ]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved all RFQs
 */
router.get("/", requireSignIn, getAllRFQs);

/**
 * @swagger
 * /rfq:
 *   post:
 *     summary: Create a new RFQ
 *     tags: [RFQ]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               uid:
 *                 type: string
 *               jobNo:
 *                 type: string
 *               subJobNo:
 *                 type: string
 *               category:
 *                 type: string
 *               subcategory:
 *                 type: string
 *               client:
 *                 type: string
 *               name:
 *                 type: string
 *               qty:
 *                 type: number
 *               deadline:
 *                 type: string
 *                 format: date-time
 *               aiBaseRate:
 *                 type: number
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: RFQ Created successfully
 */
router.post("/", requireSignIn, upload.single("image"), createRFQ);

/**
 * @swagger
 * /rfq/{id}:
 *   put:
 *     summary: Update an existing RFQ
 *     tags: [RFQ]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The RFQ ID
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               jobNo:
 *                 type: string
 *               subJobNo:
 *                 type: string
 *               category:
 *                 type: string
 *               subcategory:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: RFQ Updated successfully
 */
router.put("/:id", requireSignIn, upload.single("image"), updateRFQ);

/**
 * @swagger
 * /rfq/jobs-list:
 *   get:
 *     summary: Get available job numbers for RFQ
 *     tags: [RFQ]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved available job numbers
 */
router.get("/jobs-list", requireSignIn, getAvailableJobNos);

/**
 * @swagger
 * /rfq/packing-jobs-list:
 *   get:
 *     summary: Get packing available jobs
 *     tags: [RFQ]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved packing available jobs
 */
router.get("/packing-jobs-list", requireSignIn, getPackingAvailableJobs);

/**
 * @swagger
 * /rfq/sub-jobs/{jobNo}:
 *   get:
 *     summary: Get sub-jobs for a specific job number
 *     tags: [RFQ]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobNo
 *         required: true
 *         schema:
 *           type: string
 *         description: Job Number
 *     responses:
 *       200:
 *         description: Successfully retrieved sub-jobs
 */
router.get("/sub-jobs/:jobNo", requireSignIn, getSubJobsForJob);

/**
 * @swagger
 * /rfq/packing-sub-jobs/{jobNo}:
 *   get:
 *     summary: Get packing sub-jobs for an AI tab
 *     tags: [RFQ]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobNo
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved packing sub-jobs
 */
router.get("/packing-sub-jobs/:jobNo", requireSignIn, getPackingSubJobsForJob);

router.get("/store-requests", requireSignIn, getStoreRFQPendingRequests);
router.get("/store-request-details/:id", requireSignIn, getStoreRFQRequestDetails);

/**
 * @swagger
 * /rfq/job-details/{id}:
 *   get:
 *     summary: Get material details for a job
 *     tags: [RFQ]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved material details
 */
router.get("/job-details/:id", requireSignIn, getMaterialDetails);

/**
 * @swagger
 * /rfq/packing-details/{id}:
 *   get:
 *     summary: Get packing details for Sequential Packing AI
 *     tags: [RFQ]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved packing details
 */
router.get("/packing-details/:id", requireSignIn, getPackingDetails);

/**
 * @swagger
 * /rfq/mark-pack-purchased/{salesOrderId}:
 *   patch:
 *     summary: Mark a sub-job's BOM as having its Packing AI RFQ created
 *     tags: [RFQ]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: salesOrderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully marked pack purchased
 */
router.patch("/mark-pack-purchased/:salesOrderId", requireSignIn, markPackPurchased);

// Vendor search by material keyword
router.get("/vendors-by-material", requireSignIn, getVendorsByMaterial);

// Broadcast RFQ to vendors (creates token + sets stage)
router.post("/broadcast/:id", requireSignIn, broadcastRFQ);

// Send PO emails to awarded vendors
router.post("/send-po/:id", requireSignIn, sendPOEmails);

// Public routes (no auth) — vendor opens link and views/submits quote
router.get("/vendor-view/:id/:token", getVendorRFQView);
router.post("/vendor-quote/:id/:token", submitVendorQuote);

// Get Next PO Number dynamically
router.get("/next-po/fetch", requireSignIn, getNextPoNumber);

// ─── Procurement Coordination ─────────────────────────────────────────────────
// List all active POs for the Coordination Kanban
router.get("/coord/list", requireSignIn, getCoordRFQs);
// Move a PO to a different coordination stage
router.patch("/coord/:id/stage", requireSignIn, updateCoordStage);
// Update ETA with mandatory remark
router.patch("/coord/:id/eta", requireSignIn, updateCoordETA);
// Append a free-text coordinator remark / log entry
router.patch("/coord/:id/remark", requireSignIn, addCoordRemark);
// Update inward accounting numbers (ordered / good / rejected / re-inward)
router.patch("/coord/:id/inward", requireSignIn, updateInwardAccounting);

// ─── Per-Award (PO Number) Coordination ────────────────────────────────────────
// Each award/PO number has its own stage, ETA, and remark log
router.patch("/coord/:rfqId/award/:poNumber/stage", requireSignIn, updateAwardCoordStage);
router.patch("/coord/:rfqId/award/:poNumber/eta", requireSignIn, updateAwardCoordETA);
router.patch("/coord/:rfqId/award/:poNumber/restore-eta", requireSignIn, restoreAwardCoordETA);
router.patch("/coord/:rfqId/award/:poNumber/remark", requireSignIn, addAwardCoordRemark);
router.patch("/coord/:rfqId/award/:poNumber/inward", requireSignIn, updateAwardInwardAccounting);
router.patch("/coord/:rfqId/award/:poNumber/inward-action", requireSignIn, upload.any(), awardInwardAction);
router.patch("/coord/:rfqId/award/:poNumber/accept-qty", requireSignIn, acceptAwardQtyChange);
router.patch("/coord/:rfqId/award/:poNumber/accept-date", requireSignIn, acceptAwardDateChange);

export default router;
