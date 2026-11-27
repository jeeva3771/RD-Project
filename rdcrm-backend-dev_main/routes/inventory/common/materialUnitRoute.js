import express from "express";
import {
  getAllUnits,
  createUnit,
  updateUnit,
  deleteUnit,
} from "../../../controllers/inventory/common/materialUnitController.js";

import { requireSignIn } from "../../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Material Units
 *   description: Material unit management
 */

/**
 * @swagger
 * /materialunit:
 *   get:
 *     summary: Get all material units
 *     tags: [Material Units]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of material units retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       short_code:
 *                         type: string
 *                       description:
 *                         type: string
 *                       is_active:
 *                         type: boolean
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", requireSignIn, getAllUnits);

/**
 * @swagger
 * /materialunit:
 *   post:
 *     summary: Create material unit
 *     tags: [Material Units]
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
 *               - name
 *             properties:
 *               id:
 *                 type: string
 *                 example: MUNIT001
 *               name:
 *                 type: string
 *                 example: Kilogram
 *               short_code:
 *                 type: string
 *                 example: kg
 *               description:
 *                 type: string
 *                 example: Unit of mass
 *               is_active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Material unit created successfully
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
 *       409:
 *         description: Material unit already exists
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/", requireSignIn, createUnit);

/**
 * @swagger
 * /materialunit/{id}:
 *   put:
 *     summary: Update material unit
 *     tags: [Material Units]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Material unit ID
 *         example: MUNIT001
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Gram
 *               short_code:
 *                 type: string
 *                 example: g
 *               description:
 *                 type: string
 *                 example: Updated description
 *               is_active:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Material unit updated successfully
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
 *       404:
 *         description: Material unit not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put("/:id", requireSignIn, updateUnit);

/**
 * @swagger
 * /materialunit/{id}:
 *   delete:
 *     summary: Delete material unit
 *     tags: [Material Units]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Material unit ID
 *         example: MUNIT001
 *     responses:
 *       200:
 *         description: Material unit deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Material unit not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.delete("/:id", requireSignIn, deleteUnit);

export default router;
