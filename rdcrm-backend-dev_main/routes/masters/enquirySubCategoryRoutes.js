import express from "express";
import {
  getAllEnquirySubCategories,
  getEnquirySubCategoryById,
  createEnquirySubCategory,
  updateEnquirySubCategory,
  deleteEnquirySubCategory,
} from "../../controllers/masters/enquirySubCategoryController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /enquirysubcategory:
 *   get:
 *     summary: Get all enquiry subcategories with pagination, filtering, and sorting
 *     tags: [Enquiry SubCategory]
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
 *         description: Search by subcategory name
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
 *         description: List of enquiry subcategories retrieved successfully
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
 *                   example: "Enquiry subcategories retrieved successfully"
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
router.get("/", requireSignIn, getAllEnquirySubCategories);

/**
 * @swagger
 * /enquirysubcategory/{id}:
 *   get:
 *     summary: Get enquiry subcategory by ID
 *     tags: [Enquiry SubCategory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Enquiry SubCategory ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Enquiry subcategory details retrieved successfully
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
 *                       example: "Pricing Question"
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
 *         description: Enquiry subcategory not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", requireSignIn, getEnquirySubCategoryById);

/**
 * @swagger
 * /enquirysubcategory:
 *   post:
 *     summary: Create a new enquiry subcategory
 *     tags: [Enquiry SubCategory]
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
 *                 description: Enquiry subcategory name
 *                 example: "Pricing Question"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       201:
 *         description: Enquiry subcategory created successfully
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
 *                   example: "Enquiry subcategory created successfully"
 *                 data:
 *                   type: object
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized - User ID not found
 *       409:
 *         description: Enquiry subcategory already exists
 *       500:
 *         description: Internal server error
 */
router.post("/", requireSignIn, createEnquirySubCategory);

/**
 * @swagger
 * /enquirysubcategory/{id}:
 *   put:
 *     summary: Update enquiry subcategory details
 *     tags: [Enquiry SubCategory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Enquiry SubCategory ID (nanoid)
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
 *                 description: Enquiry subcategory name
 *                 example: "Delivery Question"
 *               is_active:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Enquiry subcategory updated successfully
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
 *                   example: "Enquiry subcategory updated successfully"
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized - User ID not found
 *       404:
 *         description: Enquiry subcategory not found
 *       409:
 *         description: Enquiry subcategory name already in use
 *       500:
 *         description: Internal server error
 */
router.put("/:id", requireSignIn, updateEnquirySubCategory);

/**
 * @swagger
 * /enquirysubcategory/{id}:
 *   delete:
 *     summary: Delete an enquiry subcategory
 *     tags: [Enquiry SubCategory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Enquiry SubCategory ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Enquiry subcategory deleted successfully
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
 *                   example: "Enquiry subcategory deleted successfully"
 *                 data:
 *                   type: object
 *       404:
 *         description: Enquiry subcategory not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", requireSignIn, deleteEnquirySubCategory);

export default router;
