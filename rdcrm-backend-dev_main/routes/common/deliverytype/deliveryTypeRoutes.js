import express from "express";
import {
 getAllDeliveryTypes,
 insertDeliveryType,
deleteDeliveryType
} from "../../../controllers/common/deliveryTypeController.js";
import { requireSignIn } from "../../../middleware/authMiddleware.js";


const router = express.Router();

/**
 * @swagger
 * /deliverytype:
 *   get:
 *     summary: Get all delivery types with optional sorting
 *     tags: [Delivery Type]
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
 *         description: List of delivery types retrieved successfully
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
 *                         example: "Express Delivery"
 *                       is_active:
 *                         type: boolean
 *                         example: true
 *                       created_by:
 *                         type: object
 *                         description: User object without sensitive fields (password, permission, etc.)
 *       500:
 *         description: Internal server error
 */
router.get("/",requireSignIn,  getAllDeliveryTypes);

/**
 * @swagger
 * /deliverytype:
 *   post:
 *     summary: Create a new delivery type
 *     tags: [Delivery Type]
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
 *                 description: Delivery type name
 *                 example: "Express Delivery"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       201:
 *         description: Delivery type created successfully
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
 *                   example: "Delivery type created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "abc123def4567890"
 *                     name:
 *                       type: string
 *                       example: "Express Delivery"
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
 *         description: Delivery type already exists
 *       500:
 *         description: Internal server error
 */
router.post("/",requireSignIn,  insertDeliveryType);

/**
 * @swagger
 * /deliverytype/{id}:
 *   delete:
 *     summary: Delete a delivery type
 *     tags: [Delivery Type]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Delivery Type ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Delivery type deleted successfully
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
 *                   example: "Delivery type deleted successfully"
 *                 data:
 *                   type: object
 *       404:
 *         description: Delivery type not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id",requireSignIn,  deleteDeliveryType);

export default router;