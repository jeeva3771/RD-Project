import express from "express";
import {
    getAllStoreIssues,
    updateMaterialLog,
    markStoreEscalation,
    authorizeStoreIssue,
    migratePushedJobsToStore,
    clearStoreFlags
} from "../../controllers/store/materialIssueController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /store-issue/all:
 *   get:
 *     summary: Get all store material issue jobs
 *     tags: [Store Module]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [NEW, PARTIAL, ISSUED, ALERT, All]
 *         description: Filter by job status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by job number, product, or client
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/all", requireSignIn, getAllStoreIssues);

/**
 * @swagger
 * /store-issue/log/{id}/{material_id}:
 *   post:
 *     summary: Log material issue or return
 *     tags: [Store Module]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Store Job ID
 *       - in: path
 *         name: material_id
 *         required: true
 *         description: Material Item ID (within the job)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [qty, type]
 *             properties:
 *               qty:
 *                 type: number
 *               type:
 *                 type: string
 *                 enum: [ISSUE, RETURN]
 *               dept:
 *                 type: string
 *               recipient:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated successfully
 */
router.post("/log/:id/:material_id", requireSignIn, updateMaterialLog);

/**
 * @swagger
 * /store-issue/escalate/{id}:
 *   post:
 *     summary: Mark a job for quantity/data alert escalation
 *     tags: [Store Module]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Store Job ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [remark]
 *             properties:
 *               remark:
 *                 type: string
 *     responses:
 *       200:
 *         description: Escalated successfully
 */
router.post("/escalate/:id", requireSignIn, markStoreEscalation);

/**
 * @swagger
 * /store-issue/migrate:
 *   get:
 *     summary: Sync existing Pushed jobs to Store module
 *     tags: [Store Module]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Migration completed
 */
router.get("/migrate", requireSignIn, migratePushedJobsToStore);

/**
 * @swagger
 * /store-issue/authorize/{id}:
 *   post:
 *     summary: Authorize completion of store material issue
 *     tags: [Store Module]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Store Job ID
 *     responses:
 *       200:
 *         description: Authorized successfully
 */
router.post("/authorize/:id", requireSignIn, authorizeStoreIssue);
router.post("/clear-flags/:id", requireSignIn, clearStoreFlags);

export default router;
