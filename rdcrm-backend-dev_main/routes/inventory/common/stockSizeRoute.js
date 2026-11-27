import express from "express";
import {
  getAllStockSizes,
  getStockSizeById,
  createStockSize,
  updateStockSize,
  deleteStockSize
} from "../../../controllers/inventory/common/stockSizeController.js";
import { requireSignIn } from "../../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: StockSize
 *   description: Stock size master management
 */

/**
 * @swagger
 * /stock-sizes:
 *   get:
 *     summary: Get all stock sizes
 *     tags: [StockSize]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           example: "24x48"
 *     responses:
 *       200:
 *         description: Stock sizes fetched successfully
 */
router.get("/", requireSignIn, getAllStockSizes);

/**
 * @swagger
 * /stock-sizes/{id}:
 *   get:
 *     summary: Get stock size by ID
 *     tags: [StockSize]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "AbC123xYz"
 *     responses:
 *       200:
 *         description: Stock size fetched successfully
 *       404:
 *         description: Stock size not found
 */
router.get("/:id", requireSignIn, getStockSizeById);

/**
 * @swagger
 * /stocksizes:
 *   post:
 *     summary: Create a stock size
 *     tags: [StockSize]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - width
 *               - height
 *             properties:
 *               width:
 *                 type: number
 *                 example: 24
 *                 description: Width of the stock
 *               height:
 *                 type: number
 *                 example: 48
 *                 description: Height of the stock
 *               unit:
 *                 type: string
 *                 example: inch
 *                 default: inch
 *                 description: Unit of measurement
 *               is_active:
 *                 type: boolean
 *                 example: true
 *                 default: true
 *     responses:
 *       201:
 *         description: Stock size created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     size:
 *                       type: string
 *                       example: "24x48"
 *                       description: Auto-generated from width x height
 *                     width:
 *                       type: number
 *                     height:
 *                       type: number
 *                     unit:
 *                       type: string
 *                     is_active:
 *                       type: boolean
 *       409:
 *         description: Stock size already exists
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

router.post("/", requireSignIn, createStockSize);

/**
 * @swagger
 * /stock-sizes/{id}:
 *   put:
 *     summary: Update stock size
 *     tags: [StockSize]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "AbC123xYz"
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               width:
 *                 type: number
 *                 example: 48
 *               height:
 *                 type: number
 *                 example: 96
 *               unit:
 *                 type: string
 *                 example: inch
 *               is_active:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Stock size updated successfully
 *       404:
 *         description: Stock size not found
 */
router.put("/:id", requireSignIn, updateStockSize);

/**
 * @swagger
 * /stock-sizes/{id}:
 *   delete:
 *     summary: Delete stock size
 *     tags: [StockSize]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "AbC123xYz"
 *     responses:
 *       200:
 *         description: Stock size deleted successfully
 *       404:
 *         description: Stock size not found
 */
router.delete("/:id", requireSignIn, deleteStockSize);

export default router;
