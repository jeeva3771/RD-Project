import express from "express";

import { requireSignIn } from "../../../middleware/authMiddleware.js";
import { deleteDeliverymode, getAllDeliverymode, insertDeliverymode } from "../../../controllers/common/delivery_modeController.js";


const router = express.Router();

/**
 * @swagger
 * /deliverymode:
 *   get:
 *     summary: Get all delivery modes with optional sorting
 *     tags: [Delivery Mode]
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
 *         description: List of delivery modes retrieved successfully
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
 *                         example: "By Road"
 *                       is_active:
 *                         type: boolean
 *                         example: true
 *                       created_by:
 *                         type: object
 *                         description: User object without sensitive fields (password, permission, etc.)
 *       500:
 *         description: Internal server error
 */
router.get("/",requireSignIn,  getAllDeliverymode);

/**
 * @swagger
 * /deliverymode:
 *   post:
 *     summary: Create a new delivery mode
 *     tags: [Delivery Mode]
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
 *                 description: Delivery mode name
 *                 example: "By Road"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       201:
 *         description: Delivery mode created successfully
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
 *                   example: "Delivery mode created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "abc123def4567890"
 *                     name:
 *                       type: string
 *                       example: "By Road"
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
 *         description: Delivery mode already exists
 *       500:
 *         description: Internal server error
 */
router.post("/",requireSignIn,  insertDeliverymode);

/**
 * @swagger
 * /deliverymode/{id}:
 *   delete:
 *     summary: Delete a delivery mode
 *     tags: [Delivery Mode]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Delivery Mode ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Delivery mode deleted successfully
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
 *                   example: "Delivery mode deleted successfully"
 *                 data:
 *                   type: object
 *       404:
 *         description: Delivery mode not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id",requireSignIn,  deleteDeliverymode);

export default router;