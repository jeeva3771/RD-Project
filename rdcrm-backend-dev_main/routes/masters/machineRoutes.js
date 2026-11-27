import express from "express";
import {
  getAllMachines,
  getMachineById,
  createMachine,
  updateMachine,
  deleteMachine,
} from "../../controllers/masters/machineController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /machine:
 *   get:
 *     summary: Get all machines with pagination, filtering, and sorting
 *     tags: [Machine]
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
 *         description: Search by machine name
 *       - in: query
 *         name: departmentname
 *         schema:
 *           type: string
 *         description: Filter by department ID(s) - comma separated for multiple departments
 *         example: "507f1f77bcf86cd799439011,507f1f77bcf86cd799439012"
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, machine_number, department, status, is_active, maintanence]
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of machines retrieved successfully
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
 *                 sortBy:
 *                   type: string
 *                   example: "name"
 *                 sortOrder:
 *                   type: integer
 *                   example: 1
 *       500:
 *         description: Internal server error
 */
router.get("/", requireSignIn, getAllMachines);

/**
 * @swagger
 * /machine/{id}:
 *   get:
 *     summary: Get machine by ID
 *     tags: [Machine]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Machine ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Machine details retrieved successfully
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
 *                       example: "CNC Machine 1"
 *                     machine_number:
 *                       type: string
 *                       example: "MCH-001"
 *                     department:
 *                       type: object
 *                     maintanence:
 *                       type: array
 *                       items:
 *                         type: string
 *                     type:
 *                       type: string
 *                     add_fields:
 *                       type: array
 *                       items:
 *                         type: object
 *                     is_active:
 *                       type: boolean
 *                     created_by:
 *                       type: object
 *                     created_at:
 *                       type: string
 *                     updated_by:
 *                       type: array
 *                       items:
 *                         type: object
 *                     updated_at:
 *                       type: string
 *       404:
 *         description: Machine not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", requireSignIn, getMachineById);

/**
 * @swagger
 * /machine:
 *   post:
 *     summary: Create a new machine
 *     tags: [Machine]
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
 *               - department
 *             properties:
 *               name:
 *                 type: string
 *                 description: Machine name
 *                 example: "CNC Machine 1"
 *               machine_number:
 *                 type: string
 *                 description: Unique machine number
 *                 example: "MCH-001"
 *               department:
 *                 type: string
 *                 description: Department ID (ObjectId)
 *                 example: "507f1f77bcf86cd799439011"
 *               maintanence:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Maintenance schedules or types
 *                 example: ["monthly", "quarterly"]
 *               type:
 *                 type: string
 *                 description: Machine type
 *                 example: "CNC"
 *               location:
 *                 type: string
 *                 description: Location or studio bay
 *                 example: "Laser Studio"
 *               commission_date:
 *                 type: string
 *                 description: Purchase / Commission Date
 *                 example: "2022-01-15"
 *               last_service_date:
 *                 type: string
 *                 description: Last Service Date
 *                 example: "2026-03-10"
 *               gross_cost:
 *                 type: number
 *                 description: Gross purchase cost
 *                 example: 1850000
 *               book_value:
 *                 type: number
 *                 description: Current book value
 *                 example: 1110000
 *               accumulated_depreciation:
 *                 type: number
 *                 description: Total accumulated depreciation
 *                 example: 740000
 *               add_fields:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     key:
 *                       type: string
 *                       example: "capacity"
 *                     value:
 *                       type: string
 *                       example: "500kg"
 *                 description: Additional custom fields
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       201:
 *         description: Machine created successfully
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
 *                   example: "Machine created successfully"
 *                 data:
 *                   type: object
 *       400:
 *         description: Missing required fields - 'name' and 'department'
 *       401:
 *         description: Unauthorized - User ID not found
 *       409:
 *         description: Machine number already exists
 *       500:
 *         description: Internal server error
 */
router.post("/", requireSignIn, createMachine);

/**
 * @swagger
 * /machine/{id}:
 *   put:
 *     summary: Update machine details
 *     tags: [Machine]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Machine ID (nanoid)
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
 *                 description: Machine name
 *                 example: "CNC Machine 1 Updated"
 *               machine_number:
 *                 type: string
 *                 description: Unique machine number
 *                 example: "MCH-001-V2"
 *               department:
 *                 type: string
 *                 description: Department ID (ObjectId)
 *                 example: "507f1f77bcf86cd799439011"
 *               maintanence:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Maintenance schedules or types
 *                 example: ["weekly", "monthly"]
 *               type:
 *                 type: string
 *                 description: Machine type
 *                 example: "Advanced CNC"
 *               location:
 *                 type: string
 *                 description: Location or studio bay
 *                 example: "Laser Studio"
 *               commission_date:
 *                 type: string
 *                 description: Purchase / Commission Date
 *                 example: "2022-01-15"
 *               last_service_date:
 *                 type: string
 *                 description: Last Service Date
 *                 example: "2026-03-10"
 *               gross_cost:
 *                 type: number
 *                 description: Gross purchase cost
 *                 example: 1850000
 *               book_value:
 *                 type: number
 *                 description: Current book value
 *                 example: 1110000
 *               accumulated_depreciation:
 *                 type: number
 *                 description: Total accumulated depreciation
 *                 example: 740000
 *               add_fields:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     key:
 *                       type: string
 *                       example: "max_speed"
 *                     value:
 *                       type: string
 *                       example: "5000 RPM"
 *                 description: Additional custom fields
 *               is_active:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Machine updated successfully
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
 *                   example: "Machine updated successfully"
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized - User ID not found
 *       404:
 *         description: Machine not found
 *       409:
 *         description: Machine number already in use
 *       500:
 *         description: Internal server error
 */
router.put("/:id", requireSignIn, updateMachine);

/**
 * @swagger
 * /machine/{id}:
 *   delete:
 *     summary: Delete a machine
 *     tags: [Machine]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Machine ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Machine deleted successfully
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
 *                   example: "Machine deleted successfully"
 *                 data:
 *                   type: object
 *       404:
 *         description: Machine not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", requireSignIn, deleteMachine);

export default router;
