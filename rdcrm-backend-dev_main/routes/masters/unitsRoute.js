import express from "express";
import { requireSignIn } from "../../middleware/authMiddleware.js";
import {
  createUnit,
  deleteUnit,
  getAllUnits,
  getUnitById,
  updateUnit,
} from "../../controllers/masters/unitsController.js";

const router = express.Router();

/**
 * @swagger
 * /units:
 *   get:
 *     summary: Get all units with pagination, filtering, and sorting
 *     tags: [Units]
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
 *         description: Search by unit name
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category - comma separated for multiple categories
 *         example: "weight,length,volume"
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, category, quantity_measured, si_unit, imperial_unit, is_active, values, createdAt]
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
 *         description: List of units retrieved successfully
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
 *                   example: "Units retrieved successfully"
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
 *                 sortBy:
 *                   type: string
 *                   example: "name"
 *                 sortOrder:
 *                   type: string
 *                   example: "asc"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Internal server error
 */
router.get("/", requireSignIn, getAllUnits);

/**
 * @swagger
 * /units/{id}:
 *   get:
 *     summary: Get unit by ID
 *     tags: [Units]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unit ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Unit details retrieved successfully
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
 *                       example: "Kilogram"
 *                     category:
 *                       type: string
 *                       example: "weight"
 *                     quantity_measured:
 *                       type: string
 *                       example: "Mass"
 *                     si_unit:
 *                       type: string
 *                       example: "kg"
 *                     imperial_unit:
 *                       type: string
 *                       example: "pound"
 *                     imperial_symbol:
 *                       type: string
 *                       example: "lb"
 *                     values:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["kg", "g", "mg"]
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
 *         description: Unit not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", requireSignIn, getUnitById);

/**
 * @swagger
 * /units:
 *   post:
 *     summary: Create a new unit
 *     tags: [Units]
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
 *               - category
 *               - quantity_measured
 *               - si_unit
 *               - imperial_unit
 *               - imperial_symbol
 *             properties:
 *               name:
 *                 type: string
 *                 description: Unit name
 *                 example: "Kilogram"
 *               category:
 *                 type: string
 *                 description: Unit category
 *                 example: "weight"
 *               quantity_measured:
 *                 type: string
 *                 description: Type of quantity being measured
 *                 example: "Mass"
 *               si_unit:
 *                 type: string
 *                 description: SI unit symbol
 *                 example: "kg"
 *               imperial_unit:
 *                 type: string
 *                 description: Imperial unit name
 *                 example: "pound"
 *               imperial_symbol:
 *                 type: string
 *                 description: Imperial unit symbol
 *                 example: "lb"
 *               values:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of unit variations or conversions
 *                 example: ["kg", "g", "mg", "ton"]
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       201:
 *         description: Unit created successfully
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
 *                   example: "Unit created successfully"
 *                 data:
 *                   type: object
 *       400:
 *         description: Missing required field - name
 *       401:
 *         description: Unauthorized - User ID not found
 *       409:
 *         description: Unit already exists
 *       500:
 *         description: Internal server error
 */
router.post("/", requireSignIn, createUnit);

/**
 * @swagger
 * /units/{id}:
 *   put:
 *     summary: Update unit details
 *     tags: [Units]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unit ID (nanoid)
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
 *                 description: Unit name
 *                 example: "Gram"
 *               category:
 *                 type: string
 *                 description: Unit category
 *                 example: "weight"
 *               quantity_measured:
 *                 type: string
 *                 description: Type of quantity being measured
 *                 example: "Mass"
 *               si_unit:
 *                 type: string
 *                 description: SI unit symbol
 *                 example: "g"
 *               imperial_unit:
 *                 type: string
 *                 description: Imperial unit name
 *                 example: "ounce"
 *               imperial_symbol:
 *                 type: string
 *                 description: Imperial unit symbol
 *                 example: "oz"
 *               values:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of unit variations or conversions
 *                 example: ["g", "mg", "kg"]
 *               is_active:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Unit updated successfully
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
 *                   example: "Unit updated successfully"
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized - User ID not found
 *       404:
 *         description: Unit not found
 *       409:
 *         description: Unit name already in use
 *       500:
 *         description: Internal server error
 */
router.put("/:id", requireSignIn, updateUnit);

/**
 * @swagger
 * /units/{id}:
 *   delete:
 *     summary: Delete a unit
 *     tags: [Units]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unit ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Unit deleted successfully
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
 *                   example: "Unit deleted successfully"
 *                 data:
 *                   type: object
 *       404:
 *         description: Unit not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", requireSignIn, deleteUnit);

export default router;
