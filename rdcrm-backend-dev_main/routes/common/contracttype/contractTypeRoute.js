import express from "express";
import {
  getAllContractTypes,
  insertContractType,
  deleteContractType
} from "../../../controllers/common/contractTypeController.js";
import { requireSignIn } from "../../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /contracttype:
 *   get:
 *     summary: Get all contract types with filtering and sorting
 *     tags: [Contract Type]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, createdAt, updatedAt]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of contract types retrieved successfully
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
 *                         example: "Fixed Price"
 *                       is_active:
 *                         type: boolean
 *                         example: true
 *                       created_by:
 *                         type: object
 *                         description: User object without sensitive fields (password, permission, etc.)
 *       500:
 *         description: Internal server error
 */
router.get("/", requireSignIn, getAllContractTypes);

/**
 * @swagger
 * /contracttype:
 *   post:
 *     summary: Create a new contract type
 *     tags: [Contract Type]
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
 *                 description: Contract type name
 *                 example: "Fixed Price"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       201:
 *         description: Contract type created successfully
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
 *                   example: "Contract type created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "abc123def4567890"
 *                     name:
 *                       type: string
 *                       example: "Fixed Price"
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
 *         description: Contract type already exists
 *       500:
 *         description: Internal server error
 */
router.post("/", requireSignIn, insertContractType);

/**
 * @swagger
 * /contracttype/{id}:
 *   delete:
 *     summary: Delete a contract type
 *     tags: [Contract Type]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Contract Type ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Contract type deleted successfully
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
 *                   example: "Contract type deleted successfully"
 *                 data:
 *                   type: object
 *       404:
 *         description: Contract type not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", requireSignIn, deleteContractType);

export default router;