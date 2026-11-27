import express from "express";
import {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../../controllers/masters/departmentController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /department:
 *   get:
 *     summary: Get all departments with pagination and filtering
 *     tags: [Department]
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
 *         description: Search by department name
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by department type
 *       - in: query
 *         name: sortField
 *         schema:
 *           type: string
 *         description: Field to sort by (e.g., name, type, is_active)
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of departments retrieved successfully
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
 *                       _id:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439011"
 *                       id:
 *                         type: string
 *                         example: "abc123def4567890"
 *                       name:
 *                         type: string
 *                         example: "Production Department"
 *                       type:
 *                         type: string
 *                         example: "Manufacturing"
 *                       is_active:
 *                         type: boolean
 *                         example: true
 *                       under_process:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["Cutting", "Assembly"]
 *                       created_by_user:
 *                         type: object
 *                       created_at:
 *                         type: string
 *                         example: "2024-01-15"
 *                       updated_by:
 *                         type: array
 *                         items:
 *                           type: object
 *                       updated_at:
 *                         type: string
 *                         example: "2024-02-20"
 *       500:
 *         description: Internal server error
 */
router.get("/", requireSignIn, getAllDepartments);

/**
 * @swagger
 * /department/{id}:
 *   get:
 *     summary: Get department by ID
 *     tags: [Department]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Department ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Department details retrieved successfully
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
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439011"
 *                     id:
 *                       type: string
 *                       example: "abc123def4567890"
 *                     name:
 *                       type: string
 *                       example: "Production Department"
 *                     type:
 *                       type: string
 *                       example: "Manufacturing"
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     created_by:
 *                       type: object
 *                     created_at:
 *                       type: string
 *                       example: "2024-01-15"
 *                     updated_by:
 *                       type: array
 *                       items:
 *                         type: object
 *                     updated_at:
 *                       type: string
 *                       example: "2024-02-20"
 *       404:
 *         description: Department not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", requireSignIn, getDepartmentById);

/**
 * @swagger
 * /department:
 *   post:
 *     summary: Create a new department
 *     tags: [Department]
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
 *                 description: Department name
 *                 example: "Quality Control"
 *               type:
 *                 type: string
 *                 description: Department type
 *                 example: "Inspection"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       201:
 *         description: Department created successfully
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
 *                   example: "Department created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439011"
 *                     id:
 *                       type: string
 *                       example: "abc123def4567890"
 *                     name:
 *                       type: string
 *                       example: "Quality Control"
 *                     type:
 *                       type: string
 *                       example: "Inspection"
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     created_by:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439012"
 *                     created_at:
 *                       type: string
 *                       example: "2024-01-15"
 *       400:
 *         description: Validation error - Missing required fields or invalid 'Name'
 *       401:
 *         description: Unauthorized - User ID not found
 *       409:
 *         description: Department name already exists
 *       500:
 *         description: Internal server error
 */
router.post("/", requireSignIn, createDepartment);

/**
 * @swagger
 * /department/{id}:
 *   put:
 *     summary: Update department details
 *     tags: [Department]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Department ID (nanoid)
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
 *                 description: Department name
 *                 example: "Updated Quality Control"
 *               type:
 *                 type: string
 *                 description: Department type
 *                 example: "Testing"
 *               is_active:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Department updated successfully
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
 *                   example: "Department updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439011"
 *                     id:
 *                       type: string
 *                       example: "abc123def4567890"
 *                     name:
 *                       type: string
 *                       example: "Updated Quality Control"
 *                     type:
 *                       type: string
 *                       example: "Testing"
 *                     is_active:
 *                       type: boolean
 *                       example: false
 *                     created_by:
 *                       type: object
 *                     created_at:
 *                       type: string
 *                       example: "2024-01-15"
 *                     updated_by:
 *                       type: object
 *                     updated_at:
 *                       type: string
 *                       example: "2024-02-20"
 *       401:
 *         description: Unauthorized - User ID not found
 *       404:
 *         description: Department not found
 *       409:
 *         description: Department name already in use
 *       500:
 *         description: Internal server error
 */
router.put("/:id", requireSignIn, updateDepartment);

/**
 * @swagger
 * /department/{id}:
 *   delete:
 *     summary: Delete a department
 *     tags: [Department]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Department ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Department deleted successfully
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
 *                   example: "Department deleted successfully"
 *                 data:
 *                   type: object
 *       400:
 *         description: Department cannot be deleted because it is linked with processes, machines, or users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Department cannot be deleted because it is linked with one or more processes."
 *       404:
 *         description: Department not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", requireSignIn, deleteDepartment);

export default router;