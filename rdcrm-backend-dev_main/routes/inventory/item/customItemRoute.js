import express from "express";
import {
  createMaterial,
  getAllMaterials,
  updateMaterial,
  deleteMaterial,
  getItemsStockByIds,
} from "../../../controllers/inventory/customItem/customItemController.js";
import { requireSignIn } from "../../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Custom Item
 *   description: Inventory items / materials management
 */

/**
 * @swagger
 * /items:
 *   get:
 *     summary: Get all items (materials)
 *     tags: [Item]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: Acrylic
 *       - in: query
 *         name: item_type
 *         schema:
 *           type: string
 *           enum: [sheet, direct, unit, capacity, logic]
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Items fetched successfully
 */
router.get("/", requireSignIn, getAllMaterials);

/**
 * @swagger
 * /items/stock:
 *   post:
 *     summary: Get stock for multiple items by their IDs
 *     tags: [Item]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Stock fetched successfully
 */
router.post("/stock", requireSignIn, getItemsStockByIds);

/**
 * @swagger
 * /items:
 *   post:
 *     summary: Create a new item (material)
 *     tags: [Item]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - item_code
 *               - name
 *               - type_id
 *               - category_id
 *               - item_type
 *               - unit
 *             properties:
 *               id:
 *                 type: string
 *                 example: m1
 *               item_code:
 *                 type: string
 *                 example: ACRY_3MM
 *               name:
 *                 type: string
 *                 example: 3 MM Acrylic Sheet
 *               type_id:
 *                 type: string
 *                 example: 64f12abc98d1
 *               category_id:
 *                 type: string
 *                 example: 64f34abc77e1
 *               item_type:
 *                 type: string
 *                 enum: [sheet, direct, unit, capacity, logic]
 *               unit:
 *                 type: string
 *                 example: 64f99unit123
 *               price:
 *                 type: string
 *                 example: "120"
 *               cost:
 *                 type: string
 *                 example: "95"
 *               stock_sizes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["SS_24x48"]
 *               min_stock:
 *                 type: number
 *                 example: 10
 *               max_stock:
 *                 type: number
 *                 example: 200
 *               is_active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Item created successfully
 *       409:
 *         description: Item already exists
 */
router.post("/", requireSignIn, createMaterial);

/**
 * @swagger
 * /items/{id}:
 *   put:
 *     summary: Update item (material)
 *     tags: [Item]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: m1
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: string
 *               cost:
 *                 type: string
 *               stock:
 *                 type: number
 *               min_stock:
 *                 type: number
 *               max_stock:
 *                 type: number
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Item updated successfully
 *       404:
 *         description: Item not found
 */
router.put("/:id", requireSignIn, updateMaterial);

/**
 * @swagger
 * /items/{id}:
 *   delete:
 *     summary: Delete item (material)
 *     tags: [Item]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: m1
 *     responses:
 *       200:
 *         description: Item deleted successfully
 *       404:
 *         description: Item not found
 */
router.delete("/:id", requireSignIn, deleteMaterial);

export default router;
