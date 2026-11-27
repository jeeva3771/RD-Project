import express from "express";
import {
 getAllCouriers,
 insertCourier,
 deleteCourier
} from "../../../controllers/common/courierController.js";
import { requireSignIn } from "../../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /courier:
 *   get:
 *     summary: Get all couriers with optional sorting
 *     tags: [Courier]
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
 *         description: List of couriers retrieved successfully
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
 *                         example: "FedEx"
 *                       is_active:
 *                         type: boolean
 *                         example: true
 *                       created_by:
 *                         type: object
 *                         description: User object without sensitive fields (password, permission, etc.)
 *       500:
 *         description: Internal server error
 */
router.get("/", requireSignIn, getAllCouriers);

/**
 * @swagger
 * /courier:
 *   post:
 *     summary: Create a new courier
 *     tags: [Courier]
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
 *                 description: Courier name
 *                 example: "FedEx"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       201:
 *         description: Courier created successfully
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
 *                   example: "Courier created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "abc123def4567890"
 *                     name:
 *                       type: string
 *                       example: "FedEx"
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
 *         description: Courier already exists
 *       500:
 *         description: Internal server error
 */
router.post("/", requireSignIn, insertCourier);

/**
 * @swagger
 * /courier/{id}:
 *   delete:
 *     summary: Delete a courier
 *     tags: [Courier]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Courier ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Courier deleted successfully
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
 *                   example: "Courier deleted successfully"
 *                 data:
 *                   type: object
 *       404:
 *         description: Courier not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", requireSignIn,  deleteCourier);

export default router;