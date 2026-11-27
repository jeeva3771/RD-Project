import express from "express";
import {
  getAllProcesses,
  getProcessById,
  createProcess,
  updateProcess,
  deleteProcess,
  checkServiceCategoryExists
} from "../../controllers/masters/processController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /process/check-service-exist:
 *   get:
 *     summary: Check if service category exists
 *     tags: [Process]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: service_category
 *         required: true
 *         schema:
 *           type: string
 *         description: Service category ID to check
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Service category check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 exists:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Service category is available"
 *       400:
 *         description: Service category is required
 *       500:
 *         description: Internal server error
 */
router.get("/check-service-exist", requireSignIn, checkServiceCategoryExists);

/**
 * @swagger
 * /process:
 *   get:
 *     summary: Get all processes with pagination and filtering
 *     tags: [Process]
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
 *         description: Search by name
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [Both, In House, Out Source]
 *         description: Filter by process type
 *       - in: query
 *         name: sortField
 *         schema:
 *           type: string
 *         description: Field to sort by (e.g., service_category_name, type, is_active)
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of processes retrieved successfully
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
 *       500:
 *         description: Internal server error
 */
router.get("/", requireSignIn, getAllProcesses);

/**
 * @swagger
 * /process/{id}:
 *   get:
 *     summary: Get process by ID
 *     tags: [Process]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Process ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Process details retrieved successfully
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
 *                   example: "Process fetched successfully"
 *                 data:
 *                   type: object
 *       404:
 *         description: Process not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", requireSignIn, getProcessById);

/**
 * @swagger
 * /process:
 *   post:
 *     summary: Create a new process
 *     tags: [Process]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - service_category
 *             properties:
 *               service_category:
 *                 type: string
 *                 description: Service category ID (ObjectId)
 *                 example: "507f1f77bcf86cd799439011"
 *               type:
 *                 type: string
 *                 enum: [Both, In House, Out Source]
 *                 example: "In House"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *               department:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of Department IDs (ObjectId)
 *                 example: ["507f1f77bcf86cd799439012"]
 *               machine:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of Machine IDs (ObjectId)
 *                 example: ["507f1f77bcf86cd799439013"]
 *               available_vendors:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of vendor IDs (ObjectId)
 *                 example: ["507f1f77bcf86cd799439016"]
 *               has_custom_input:
 *                 type: boolean
 *                 default: false
 *                 example: false
 *               unit_type:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["time", "quantity"]
 *               unit:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of Unit IDs (ObjectId)
 *                 example: ["507f1f77bcf86cd799439014"]
 *               variables:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     key:
 *                       type: string
 *                       example: "material_type"
 *                     label:
 *                       type: string
 *                       example: "Material Type"
 *                     allowed_values:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["plastic", "metal", "wood"]
 *                     is_rate_variable:
 *                       type: boolean
 *                       default: false
 *                       example: true
 *                     is_size_variable:
 *                       type: boolean
 *                       default: false
 *                       example: false
 *               additional_columns:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of additional column IDs (ObjectId)
 *                 example: ["507f1f77bcf86cd799439015"]
 *     responses:
 *       201:
 *         description: Process created successfully
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
 *                   example: "Process created successfully"
 *                 data:
 *                   type: object
 *       400:
 *         description: Validation error - Process service category is required
 *       401:
 *         description: Unauthorized - User ID not found
 *       409:
 *         description: Process service category already exists
 *       500:
 *         description: Internal server error
 */
router.post("/", requireSignIn, createProcess);

/**
 * @swagger
 * /process/{id}:
 *   put:
 *     summary: Update process details
 *     tags: [Process]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Process ID (nanoid)
 *         example: "abc123def4567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               service_category:
 *                 type: string
 *                 description: Service category ID (ObjectId)
 *                 example: "507f1f77bcf86cd799439011"
 *               type:
 *                 type: string
 *                 enum: [Both, In House, Out Source]
 *                 example: "Out Source"
 *               is_active:
 *                 type: boolean
 *                 example: false
 *               department:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of Department IDs (ObjectId)
 *                 example: ["507f1f77bcf86cd799439012"]
 *               machine:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of Machine IDs (ObjectId)
 *                 example: ["507f1f77bcf86cd799439013"]
 *               available_vendors:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of vendor IDs (ObjectId)
 *                 example: ["507f1f77bcf86cd799439016"]
 *               has_custom_input:
 *                 type: boolean
 *                 example: true
 *               unit_type:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["weight", "volume"]
 *               unit:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of Unit IDs (ObjectId)
 *                 example: ["507f1f77bcf86cd799439014"]
 *               variables:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     key:
 *                       type: string
 *                       example: "size"
 *                     label:
 *                       type: string
 *                       example: "Size"
 *                     allowed_values:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["small", "medium", "large"]
 *                     is_rate_variable:
 *                       type: boolean
 *                       default: false
 *                       example: false
 *                     is_size_variable:
 *                       type: boolean
 *                       default: false
 *                       example: true
 *               additional_columns:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of additional column IDs (ObjectId)
 *                 example: ["507f1f77bcf86cd799439015"]
 *     responses:
 *       200:
 *         description: Process updated successfully
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
 *                   example: "Process updated successfully"
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized - User ID not found
 *       404:
 *         description: Process not found
 *       409:
 *         description: Service name already in use
 *       500:
 *         description: Internal server error
 */
router.put("/:id", requireSignIn, updateProcess);

/**
 * @swagger
 * /process/{id}:
 *   delete:
 *     summary: Delete a process and associated rate cards
 *     tags: [Process]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Process ID (MongoDB ObjectId)
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Process and associated rate cards deleted successfully
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
 *                   example: "Process and associated rate cards deleted successfully"
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized - User ID not found
 *       404:
 *         description: Process not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", requireSignIn, deleteProcess);

export default router;