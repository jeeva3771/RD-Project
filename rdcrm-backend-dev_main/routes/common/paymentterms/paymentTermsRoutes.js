import express from "express";
import {
 getAllPaymentTerms,
 insertPaymentTerms,
deletePaymentTerms
} from "../../../controllers/common/paymentTermsController.js";

import { requireSignIn } from "../../../middleware/authMiddleware.js";
const router = express.Router();

/**
 * @swagger
 * /payment:
 *   get:
 *     summary: Get all payment terms with optional sorting
 *     tags: [Payment Terms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order by name (asc or desc). If not provided, sorts by createdAt descending
 *     responses:
 *       200:
 *         description: List of payment terms retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 10
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "abc123def4567890"
 *                       name:
 *                         type: string
 *                         example: "Net 30"
 *                       is_active:
 *                         type: boolean
 *                         example: true
 *                       created_by:
 *                         type: object
 *                         description: User object without sensitive fields (password, permission, etc.)
 *       500:
 *         description: Internal server error
 */
router.get("/", requireSignIn,  getAllPaymentTerms);

/**
 * @swagger
 * /payment:
 *   post:
 *     summary: Create a new payment terms
 *     tags: [Payment Terms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Payment terms name
 *                 example: "Net 30"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       201:
 *         description: Payment terms created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Payment terms created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "abc123def4567890"
 *                     name:
 *                       type: string
 *                       example: "Net 30"
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     created_by:
 *                       type: string
 *                       description: User ID (ObjectId)
 *                     created_at:
 *                       type: string
 *                     updated_by:
 *                       type: array
 *                       items:
 *                         type: object
 *                     updated_at:
 *                       type: string
 *       400:
 *         description: Missing required field - name
 *       401:
 *         description: Unauthorized - User ID not found
 *       409:
 *         description: Payment terms already exists
 *       500:
 *         description: Internal server error
 */
router.post("/", requireSignIn, insertPaymentTerms);

/**
 * @swagger
 * /payment/{id}:
 *   delete:
 *     summary: Delete a payment terms
 *     tags: [Payment Terms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment Terms ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Payment terms deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Payment terms deleted successfully"
 *                 data:
 *                   type: object
 *       404:
 *         description: Payment terms not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", requireSignIn, deletePaymentTerms);

export default router;