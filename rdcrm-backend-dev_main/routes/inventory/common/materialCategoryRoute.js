import express from "express";
import {
  getAllMaterialCategories,
  createMaterialCategory,
  updateMaterialCategory,
  deleteMaterialCategory,
} from "../../../controllers/inventory/common/materialCategoryController.js";

import { requireSignIn } from "../../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Material Categories
 *   description: Material category management
 */

/**
 * @swagger
 * /materialcategory:
 *   get:
 *     summary: Get all material categories
 *     tags: [Material Categories]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of material categories
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
 *                     $ref: '#/components/schemas/MaterialCategory'
 */
router.get("/", requireSignIn, getAllMaterialCategories);

/**
 * @swagger
 * /materialcategory:
 *   post:
 *     summary: Create material category
 *     tags: [Material Categories]
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
 *                 example: MCAT001
 *               name:
 *                 type: string
 *                 example: MDF
 *               description:
 *                 type: string
 *                 example: Medium Density Fiberboard
 *               is_active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Material category created successfully
 *       409:
 *         description: Material category already exists
 */
router.post("/", requireSignIn, createMaterialCategory);

/**
 * @swagger
 * /materialcategory/{id}:
 *   put:
 *     summary: Update material category
 *     tags: [Material Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "MCAT001"
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: MDF Board
 *               description:
 *                 type: string
 *                 example: Updated description
 *               is_active:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Material category updated successfully
 *       404:
 *         description: Material category not found
 */
router.put("/:id", requireSignIn, updateMaterialCategory);


/**
 * @swagger
 * /materialcategory/{id}:
 *   delete:
 *     summary: Delete material category
 *     tags: [Material Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Material category deleted
 */
router.delete("/:id", requireSignIn, deleteMaterialCategory);

export default router;
