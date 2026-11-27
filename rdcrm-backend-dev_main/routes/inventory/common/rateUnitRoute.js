import express from "express";
import {
  getAllRateUnits,
  getRateUnitById,
  createRateUnit,
  updateRateUnit,
  deleteRateUnit
} from "../../../controllers/inventory/common/rateUnitController.js";
import { requireSignIn } from "../../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: RateUnit
 *   description: Rate unit master management
 */

/**
 * @swagger
 * /rateunit:
 *   get:
 *     summary: Get all rate units
 *     tags: [RateUnit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           example: "sqin"
 *     responses:
 *       200:
 *         description: Rate units fetched successfully
 */
router.get("/", requireSignIn, getAllRateUnits);

/**
 * @swagger
 * /rateunit/{id}:
 *   get:
 *     summary: Get rate unit by ID
 *     tags: [RateUnit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "RtU123Abc"
 *     responses:
 *       200:
 *         description: Rate unit fetched successfully
 *       404:
 *         description: Rate unit not found
 */
router.get("/:id", requireSignIn, getRateUnitById);

/**
 * @swagger
 * /rateunit:
 *   post:
 *     summary: Create rate unit
 *     tags: [RateUnit]
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
 *               - symbol
 *             properties:
 *               name:
 *                 type: string
 *                 example: Square Inch
 *               symbol:
 *                 type: string
 *                 example: sqin
 *               is_active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Rate unit created successfully
 *       409:
 *         description: Rate unit already exists
 */
router.post("/", requireSignIn, createRateUnit);

/**
 * @swagger
 * /rateunit/{id}:
 *   put:
 *     summary: Update rate unit
 *     tags: [RateUnit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "RtU123Abc"
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Piece
 *               symbol:
 *                 type: string
 *                 example: pc
 *               is_active:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Rate unit updated successfully
 *       404:
 *         description: Rate unit not found
 */
router.put("/:id", requireSignIn, updateRateUnit);

/**
 * @swagger
 * /rateunit/{id}:
 *   delete:
 *     summary: Delete rate unit
 *     tags: [RateUnit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "RtU123Abc"
 *     responses:
 *       200:
 *         description: Rate unit deleted successfully
 *       404:
 *         description: Rate unit not found
 */
router.delete("/:id", requireSignIn, deleteRateUnit);

export default router;
