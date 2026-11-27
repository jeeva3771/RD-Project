import express from "express";
import {
  getAllVendors,
  getVendorNameList,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
} from "../../controllers/masters/vendorController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /vendor/name:
 *   get:
 *     summary: Get vendor name list
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: include_inactive_ids
 *         schema:
 *           type: string
 *         description: Comma-separated list of inactive vendor IDs to include
 *         example: "507f1f77bcf86cd799439011,507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Vendor name list retrieved successfully
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
 *                         example: "ABC Vendors"
 *                       is_active:
 *                         type: boolean
 *                         example: true
 *                       service_category:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *       500:
 *         description: Internal server error
 */
router.get("/name", requireSignIn, getVendorNameList);

/**
 * @swagger
 * /vendor:
 *   get:
 *     summary: Get all vendors with pagination and filtering
 *     tags: [Vendor]
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
 *         description: Search by vendor name
 *       - in: query
 *         name: service_category
 *         schema:
 *           type: string
 *         description: Filter by service category ID (ObjectId)
 *         example: "507f1f77bcf86cd799439011"
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Field to sort by (e.g., name, service_category, contract_type, is_active, status)
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of vendors retrieved successfully
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
router.get("/", requireSignIn, getAllVendors);

/**
 * @swagger
 * /vendor/{id}:
 *   get:
 *     summary: Get vendor by ID
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Vendor ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Vendor details retrieved successfully
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
 *                       example: "ABC Vendors"
 *                     email:
 *                       type: string
 *                       example: "contact@abcvendors.com"
 *                     mobile_no:
 *                       type: number
 *                       example: 9876543210
 *                     service_category:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         is_active:
 *                           type: boolean
 *                     contract_type:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         is_active:
 *                           type: boolean
 *                     address:
 *                       type: string
 *                       example: "123 Main Street, City"
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     created_by:
 *                       type: object
 *       404:
 *         description: Vendor not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", requireSignIn, getVendorById);

/**
 * @swagger
 * /vendor:
 *   post:
 *     summary: Create a new vendor
 *     tags: [Vendor]
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
 *               - email
 *               - mobile_no
 *               - service_category
 *               - contract_type
 *             properties:
 *               name:
 *                 type: string
 *                 example: "ABC Vendors"
 *               email:
 *                 type: string
 *                 example: "contact@abcvendors.com"
 *               mobile_no:
 *                 type: number
 *                 example: 9876543210
 *               service_category:
 *                 type: string
 *                 description: Service category ID (ObjectId)
 *                 example: "507f1f77bcf86cd799439011"
 *               contract_type:
 *                 type: string
 *                 description: Contract type ID (ObjectId)
 *                 example: "507f1f77bcf86cd799439012"
 *               address:
 *                 type: string
 *                 example: "123 Main Street, City, State, ZIP"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       201:
 *         description: Vendor created successfully
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
 *                   example: "Vendor created successfully"
 *                 data:
 *                   type: object
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized - User ID not found
 *       409:
 *         description: Vendor name already exists
 *       500:
 *         description: Internal server error
 */
router.post("/", requireSignIn, createVendor);

/**
 * @swagger
 * /vendor/{id}:
 *   put:
 *     summary: Update vendor details
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Vendor ID (nanoid)
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
 *                 example: "ABC Vendors Updated"
 *               email:
 *                 type: string
 *                 example: "newemail@abcvendors.com"
 *               mobile_no:
 *                 type: number
 *                 example: 9876543210
 *               service_category:
 *                 type: string
 *                 description: Service category ID (ObjectId)
 *                 example: "507f1f77bcf86cd799439011"
 *               contract_type:
 *                 type: string
 *                 description: Contract type ID (ObjectId)
 *                 example: "507f1f77bcf86cd799439012"
 *               address:
 *                 type: string
 *                 example: "456 New Address, City, State, ZIP"
 *               is_active:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Vendor updated successfully
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
 *                   example: "Vendor updated successfully"
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized - User ID not found
 *       404:
 *         description: Vendor not found
 *       409:
 *         description: Vendor name already in use
 *       500:
 *         description: Internal server error
 */
router.put("/:id", requireSignIn, updateVendor);

/**
 * @swagger
 * /vendor/{id}:
 *   delete:
 *     summary: Delete a vendor
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Vendor ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Vendor deleted successfully
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
 *                   example: "Vendor deleted successfully"
 *                 data:
 *                   type: object
 *       404:
 *         description: Vendor not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", requireSignIn, deleteVendor);

export default router;