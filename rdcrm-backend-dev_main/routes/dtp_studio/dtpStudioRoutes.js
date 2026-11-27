import express from "express";
import { requireSignIn } from "../../middleware/authMiddleware.js";
import upload from "../../middleware/multer.js";
import {
    getAllDTPJobs,
    getDTPJobById,
    updateStage,
    reworkJob,
    assignJob,
    uploadProof,
    deleteProof,
    approveRejectProof,
    updateJobStatus,
    createJobGroup,
    getJobGroupById,
    uploadFinalPrepFile,
    deleteFinalPrepFile,
    updateFinalPrepSectionStatus,
    updateAccountingDetails,
    uploadAccountingFile,
    deleteAccountingFile,
    holdUnholdDTPJob,
    holdUnholdDTPGroup,
    sendUrgencyPrompt,
    rollbackToContentProofing,
    clearChangeFlags,
    updateDTPJobDetails
} from "../../controllers/dtp_studio/dtpStudioController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: DTP Studio
 *   description: DTP Studio Workflow Management
 */

/**
 * @swagger
 * /dtp-studio:
 *   get:
 *     summary: Get all DTP jobs
 *     tags: [DTP Studio]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by job no, client, product
 *     responses:
 *       200:
 *         description: List of DTP jobs
 */
router.get("/", requireSignIn, getAllDTPJobs);

/**
 * @swagger
 * /dtp-studio/{id}:
 *   get:
 *     summary: Get DTP job by ID
 *     tags: [DTP Studio]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: DTP job details
 *       404:
 *         description: Job not found
 */
router.get("/:id", requireSignIn, getDTPJobById);

/**
 * @swagger
 * /dtp-studio/stage/{id}:
 *   put:
 *     summary: Update DTP job stage (upload files)
 *     tags: [DTP Studio]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               stage_name:
 *                 type: string
 *               status:
 *                 type: string
 *               remarks:
 *                 type: string
 *               job_sheet_files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Stage updated successfully
 */
router.put("/stage/:id", requireSignIn, upload.array("job_sheet_files"), updateStage);

/**
 * @swagger
 * /dtp-studio/rework/{id}:
 *   put:
 *     summary: Mark DTP job for rework
 *     tags: [DTP Studio]
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
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Job marked for rework
 */
router.put("/rework/:id", requireSignIn, reworkJob);

/**
 * @swagger
 * /dtp-studio/assign/{id}:
 *   put:
 *     summary: Assign DTP job to artist
 *     tags: [DTP Studio]
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
 *               assignedTo:
 *                 type: string
 *                 description: Artist user ID
 *               assignedToName:
 *                 type: string
 *                 description: Artist name
 *               assignmentNote:
 *                 type: string
 *                 description: Assignment note/reason
 *     responses:
 *       200:
 *         description: Job assigned successfully
 */
router.put("/assign/:id", requireSignIn, assignJob);
router.post("/create-group", requireSignIn, createJobGroup);
router.get("/group/:id", requireSignIn, getJobGroupById);
router.put("/update-status/:id", requireSignIn, updateJobStatus);
router.put("/upload-proof/:id", requireSignIn, upload.array("proof_files"), uploadProof);
router.put("/approve-reject-proof/:id/:fileId", requireSignIn, upload.single("rejection_file"), approveRejectProof);
router.delete("/proof/:id/:type/:fileId", requireSignIn, deleteProof);
router.put("/upload-final-prep/:id", requireSignIn, upload.array("files"), uploadFinalPrepFile);
router.delete("/delete-final-prep/:id/:materialGroupId/:fileType/:fileId", requireSignIn, deleteFinalPrepFile);
router.put("/update-final-prep-section-status/:id", requireSignIn, updateFinalPrepSectionStatus);
router.put("/update-accounting-details/:id", requireSignIn, updateAccountingDetails);
router.put("/upload-accounting-file/:id", requireSignIn, upload.single("file"), uploadAccountingFile);
router.delete("/delete-accounting-file/:id/:fileId", requireSignIn, deleteAccountingFile);
router.put("/hold-unhold/:id", requireSignIn, holdUnholdDTPJob);
router.put("/group/hold-unhold/:id", requireSignIn, holdUnholdDTPGroup);
router.put("/send-urgency-prompt/:id", requireSignIn, sendUrgencyPrompt);
router.put("/rollback/:id", requireSignIn, rollbackToContentProofing);
router.put("/clear-flags/:id", requireSignIn, clearChangeFlags);
router.put("/update-details/:id", requireSignIn, updateDTPJobDetails);

export default router;
