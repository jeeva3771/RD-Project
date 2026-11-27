import express from "express";
import {
  getAllEnquiryCategories,
  getEnquiryCategoryById,
  createEnquiryCategory,
  updateEnquiryCategory,
  deleteEnquiryCategory,
} from "../../controllers/masters/enquiryCategoryController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /enquirycategory:
 *   get:
 *     summary: Get all enquiry categories with pagination, filtering, and sorting
 *     tags: [Enquiry Category]
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
 *         description: Number of items per page (optional - if not provided, returns all records)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by category name
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: sortField
 *         schema:
 *           type: string
 *           enum: [name, is_active, createdAt]
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
 *         description: List of enquiry categories retrieved successfully
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
 *       500:
 *         description: Internal server error
 */
router.get("/", requireSignIn, getAllEnquiryCategories);

/**
 * @swagger
 * /enquirycategory/{id}:
 *   get:
 *     summary: Get enquiry category by ID
 *     tags: [Enquiry Category]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Enquiry Category ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Enquiry category details retrieved successfully
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
 *                       example: "Product Inquiry"
 *                     is_active:
 *                       type: boolean
 *                       example: true
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
 *         description: Enquiry category not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", requireSignIn, getEnquiryCategoryById);

/**
 * @swagger
 * /enquirycategory:
 *   post:
 *     summary: Create a new enquiry category
 *     tags: [Enquiry Category]
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
 *                 description: Enquiry category name
 *                 example: "Product Inquiry"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       201:
 *         description: Enquiry category created successfully
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
 *                   example: "Enquiry category created successfully"
 *                 data:
 *                   type: object
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized - User ID not found
 *       409:
 *         description: Enquiry category already exists
 *       500:
 *         description: Internal server error
 */
router.post("/", requireSignIn, createEnquiryCategory);

/**
 * @swagger
 * /enquirycategory/{id}:
 *   put:
 *     summary: Update enquiry category details
 *     tags: [Enquiry Category]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Enquiry Category ID (nanoid)
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
 *                 description: Enquiry category name
 *                 example: "Technical Support"
 *               is_active:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Enquiry category updated successfully
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
 *                   example: "Enquiry category updated successfully"
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized - User ID not found
 *       404:
 *         description: Enquiry category not found
 *       409:
 *         description: Enquiry category name already in use
 *       500:
 *         description: Internal server error
 */
router.put("/:id", requireSignIn, updateEnquiryCategory);

/**
 * @swagger
 * /enquirycategory/{id}:
 *   delete:
 *     summary: Delete an enquiry category
 *     tags: [Enquiry Category]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Enquiry Category ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Enquiry category deleted successfully
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
 *                   example: "Enquiry category deleted successfully"
 *                 data:
 *                   type: object
 *       404:
 *         description: Enquiry category not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", requireSignIn, deleteEnquiryCategory);

export default router;
