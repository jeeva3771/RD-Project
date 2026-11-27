import express from "express";
import {
  getAllServiceCategories,
  insertServiceCategory,
  deleteServiceCategory,
  getServiceCategoryById,
  updateServiceCategory
} from "../../../controllers/common/serviceCategoryController.js";
import { requireSignIn } from "../../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /servicecategory:
 *   get:
 *     summary: Get all service categories with pagination and filtering
 *     tags: [Service Category]
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
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by service category name
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, createdAt, updatedAt, is_active]
 *           default: createdAt
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
 *         description: Service categories retrieved successfully
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
 *                   example: "Services retrieved successfully"
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
 *                         example: "Printing Services"
 *                       is_active:
 *                         type: boolean
 *                         example: true
 *                       created_by:
 *                         type: object
 *                       created_at:
 *                         type: string
 *                       updated_by:
 *                         type: array
 *                       updated_at:
 *                         type: string
 *       500:
 *         description: Internal server error
 */
router.get("/", requireSignIn, getAllServiceCategories);

/**
 * @swagger
 * /servicecategory/{id}:
 *   get:
 *     summary: Get service category by ID
 *     tags: [Service Category]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Service category ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Service category retrieved successfully
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
 *                       example: "Printing Services"
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     created_by:
 *                       type: object
 *                       description: User object who created the category
 *                     created_at:
 *                       type: string
 *                       example: "2024-01-15 10:30:00"
 *                     updated_by:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           user:
 *                             type: object
 *                           date:
 *                             type: string
 *                     updated_at:
 *                       type: string
 *                       example: "2024-01-20 14:45:00"
 *       404:
 *         description: Service category not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", requireSignIn, getServiceCategoryById);

/**
 * @swagger
 * /servicecategory:
 *   post:
 *     summary: Create a new service category
 *     tags: [Service Category]
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
 *                 example: "Printing Services"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       201:
 *         description: Service category created successfully
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
 *                   example: "Service category created successfully"
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
 *                       example: "Printing Services"
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     created_by:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439012"
 *                     created_at:
 *                       type: string
 *                       example: "2024-01-15 10:30:00"
 *       400:
 *         description: Missing required field - name
 *       401:
 *         description: Unauthorized - User ID not found
 *       409:
 *         description: Service category already exists
 *       500:
 *         description: Internal server error
 */
router.post("/", requireSignIn, insertServiceCategory);

/**
 * @swagger
 * /servicecategory/{id}:
 *   put:
 *     summary: Update service category details
 *     tags: [Service Category]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Service category ID (nanoid)
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
 *                 example: "Updated Printing Services"
 *               is_active:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Service category updated successfully
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
 *                   example: "Service category updated successfully"
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
 *                       example: "Updated Printing Services"
 *                     is_active:
 *                       type: boolean
 *                       example: false
 *                     created_by:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439012"
 *                     created_at:
 *                       type: string
 *                       example: "2024-01-15 10:30:00"
 *                     updated_by:
 *                       type: object
 *                       properties:
 *                         user:
 *                           type: string
 *                         date:
 *                           type: string
 *                     updated_at:
 *                       type: string
 *                       example: "2024-01-20 14:45:00"
 *       401:
 *         description: Unauthorized - User ID not found
 *       404:
 *         description: Service category not found
 *       409:
 *         description: Category name already in use
 *       500:
 *         description: Internal server error
 */
router.put("/:id", requireSignIn, updateServiceCategory);

/**
 * @swagger
 * /servicecategory/{id}:
 *   delete:
 *     summary: Delete a service category
 *     tags: [Service Category]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Service category ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Service category deleted successfully
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
 *                   example: "Service category deleted successfully"
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
 *                       example: "Printing Services"
 *       404:
 *         description: Service category not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", requireSignIn, deleteServiceCategory);

export default router;