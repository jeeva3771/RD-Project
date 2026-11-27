import express from "express";
import {
  getAllMaterialTypes,
  createMaterialType,
  updateMaterialType,
  deleteMaterialType,
} from "../../../controllers/inventory/common/materialTypeController.js";
import { requireSignIn } from "../../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Material Types
 *   description: Material type management
 */

/**
 * @swagger
 * /materialtype:
 *   get:
 *     summary: Get all material types
 *     tags: [Material Types]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of material types
 */
router.get("/", requireSignIn, getAllMaterialTypes);

/**
 * @swagger
 * /materialtype:
 *   post:
 *     summary: Create material type
 *     tags: [Material Types]
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
 *                 example: MTYPE001
 *               name:
 *                 type: string
 *                 example: Raw Material
 *               is_active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Material type created successfully
 *       409:
 *         description: Material type already exists
 */
router.post("/", requireSignIn, createMaterialType);

/**
 * @swagger
 * /materialtype/{id}:
 *   put:
 *     summary: Update material type
 *     tags: [Material Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "MTYPE001"
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Finished Goods
 *               is_active:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Material type updated successfully
 *       404:
 *         description: Material type not found
 */
router.put("/:id", requireSignIn, updateMaterialType);


/**
 * @swagger
 * /materialtype/{id}:
 *   delete:
 *     summary: Delete material type
 *     tags: [Material Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.delete("/:id", requireSignIn, deleteMaterialType);

export default router;
