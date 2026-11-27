import express from "express";
import {
  getAllPackingTypes,
  getPackingTypeById,
  createPackingType,
  updatePackingType,
  deletePackingType,
} from "../../../controllers/common/packingTypeController.js";
import { requireSignIn } from "../../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /packingtype:
 *   get:
 *     summary: Get all packing types with pagination, search, and sorting
 *     tags: [Packing Type]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by packing type name
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order by name (asc or desc). If not provided, sorts by createdAt descending
 *     responses:
 *       200:
 *         description: List of packing types retrieved successfully
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
 *                 total:
 *                   type: integer
 *                   example: 50
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 totalPages:
 *                   type: integer
 *                   example: 5
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
 *                         example: "Carton Box"
 *                       is_active:
 *                         type: boolean
 *                         example: true
 *                       created_by:
 *                         type: object
 *                         description: User object without sensitive fields
 *       500:
 *         description: Internal server error
 */
router.get("/", requireSignIn, getAllPackingTypes);

/**
 * @swagger
 * /packingtype/{id}:
 *   get:
 *     summary: Get packing type by ID
 *     tags: [Packing Type]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Packing Type ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Packing type details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "abc123def4567890"
 *                     name:
 *                       type: string
 *                       example: "Carton Box"
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     created_by:
 *                       type: object
 *                       description: User object without sensitive fields
 *       404:
 *         description: Packing type not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", requireSignIn, getPackingTypeById);

/**
 * @swagger
 * /packingtype:
 *   post:
 *     summary: Create a new packing type
 *     tags: [Packing Type]
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
 *                 description: Packing type name
 *                 example: "Carton Box"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       201:
 *         description: Packing type created successfully
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
 *                   example: "Packing type created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "abc123def4567890"
 *                     name:
 *                       type: string
 *                       example: "Carton Box"
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
 *         description: Name is required
 *       401:
 *         description: Unauthorized - User ID not found
 *       409:
 *         description: Packing type name already exists
 *       500:
 *         description: Internal server error
 */
router.post("/", requireSignIn, createPackingType);

/**
 * @swagger
 * /packingtype/{id}:
 *   put:
 *     summary: Update packing type details
 *     tags: [Packing Type]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Packing Type ID (nanoid)
 *         example: "abc123def4567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Packing type name
 *                 example: "Wooden Crate"
 *               is_active:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Packing type updated successfully
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
 *                   example: "Packing type updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "abc123def4567890"
 *                     name:
 *                       type: string
 *                       example: "Wooden Crate"
 *                     is_active:
 *                       type: boolean
 *                       example: false
 *                     created_by:
 *                       type: object
 *                       description: User object without sensitive fields
 *       401:
 *         description: Unauthorized - User ID not found
 *       404:
 *         description: Packing type not found
 *       409:
 *         description: Packing type name already in use
 *       500:
 *         description: Internal server error
 */
router.put("/:id", requireSignIn, updatePackingType);

/**
 * @swagger
 * /packingtype/{id}:
 *   delete:
 *     summary: Delete a packing type
 *     tags: [Packing Type]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Packing Type ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Packing type deleted successfully
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
 *                   example: "Packing type deleted successfully"
 *                 data:
 *                   type: object
 *       404:
 *         description: Packing type not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", requireSignIn, deletePackingType);

export default router;
