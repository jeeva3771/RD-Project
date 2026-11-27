import express from "express";
import {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addCustomerAddress,
  addCustomerContact,
} from "../../controllers/masters/customersController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /customer:
 *   get:
 *     summary: Get all customers with pagination and filtering
 *     tags: [Customer]
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
 *         description: Search by customer name
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Field to sort by (e.g., name, is_active, createdAt)
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of customers retrieved successfully
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
router.get("/", requireSignIn, getAllCustomers);

/**
 * @swagger
 * /customer/{id}:
 *   get:
 *     summary: Get customer by ID
 *     tags: [Customer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Customer details retrieved successfully
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
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", requireSignIn, getCustomerById);

/**
 * @swagger
 * /customer:
 *   post:
 *     summary: Create a new customer
 *     tags: [Customer]
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
 *               - contact_person
 *               - mobile_no
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *                 description: Customer name
 *                 example: "Acme Corporation"
 *               contact_person:
 *                 type: string
 *                 description: Contact person name
 *                 example: "John Doe"
 *               mobile_no:
 *                 type: number
 *                 description: Mobile number
 *                 example: 9876543210
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address
 *                 example: "john.doe@acme.com"
 *               address:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - address_1
 *                     - city
 *                     - state
 *                     - postal_code
 *                   properties:
 *                     address_1:
 *                       type: string
 *                       example: "123 Main Street"
 *                     address_2:
 *                       type: string
 *                       example: "Suite 100"
 *                     city:
 *                       type: string
 *                       example: "New York"
 *                     state:
 *                       type: string
 *                       example: "NY"
 *                     postal_code:
 *                       type: string
 *                       example: "10001"
 *                     gst_no:
 *                       type: string
 *                       example: "22AAAAA0000A1Z5"
 *               delivery_type:
 *                 type: string
 *                 description: Delivery type ID (ObjectId)
 *                 example: "507f1f77bcf86cd799439011"
 *               courier:
 *                 type: string
 *                 description: Courier ID (ObjectId)
 *                 example: "507f1f77bcf86cd799439012"
 *               payment_terms:
 *                 type: string
 *                 description: Payment terms ID (ObjectId)
 *                 example: "507f1f77bcf86cd799439013"
 *               enquiries_origin:
 *                 type: string
 *                 description: Source of enquiry
 *                 example: "Website"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       201:
 *         description: Customer created successfully
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
 *                   example: "Customer created successfully"
 *                 data:
 *                   type: object
 *       400:
 *         description: Validation error - Missing required fields or invalid format
 *       401:
 *         description: Unauthorized - User ID not found
 *       409:
 *         description: Customer name already exists
 *       500:
 *         description: Internal server error
 */
router.post("/", requireSignIn, createCustomer);

/**
 * @swagger
 * /customer/{id}:
 *   put:
 *     summary: Update customer details
 *     tags: [Customer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID (nanoid)
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
 *                 description: Customer name
 *                 example: "Acme Corporation Ltd"
 *               contact_person:
 *                 type: string
 *                 description: Contact person name
 *                 example: "Jane Smith"
 *               mobile_no:
 *                 type: number
 *                 description: Mobile number
 *                 example: 9876543210
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address
 *                 example: "jane.smith@acme.com"
 *               address:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - address_1
 *                     - city
 *                     - state
 *                     - postal_code
 *                   properties:
 *                     address_1:
 *                       type: string
 *                       example: "456 Broadway"
 *                     address_2:
 *                       type: string
 *                       example: "Floor 5"
 *                     city:
 *                       type: string
 *                       example: "Los Angeles"
 *                     state:
 *                       type: string
 *                       example: "CA"
 *                     postal_code:
 *                       type: string
 *                       example: "90001"
 *                     gst_no:
 *                       type: string
 *                       example: "22AAAAA0000A1Z5"
 *               delivery_type:
 *                 type: string
 *                 description: Delivery type ID (ObjectId) - empty string to clear
 *                 example: "507f1f77bcf86cd799439011"
 *               courier:
 *                 type: string
 *                 description: Courier ID (ObjectId) - empty string to clear
 *                 example: "507f1f77bcf86cd799439012"
 *               payment_terms:
 *                 type: string
 *                 description: Payment terms ID (ObjectId) - empty string to clear
 *                 example: "507f1f77bcf86cd799439013"
 *               enquiries_origin:
 *                 type: string
 *                 description: Source of enquiry
 *                 example: "Referral"
 *               is_active:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Customer updated successfully
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
 *                   example: "Customer updated successfully"
 *                 data:
 *                   type: object
 *       400:
 *         description: Validation error - Missing required fields or invalid format
 *       401:
 *         description: Unauthorized - User ID not found
 *       404:
 *         description: Customer not found
 *       409:
 *         description: Customer name already in use
 *       500:
 *         description: Internal server error
 */
router.put("/:id", requireSignIn, updateCustomer);

/**
 * @swagger
 * /customer/{id}:
 *   delete:
 *     summary: Delete a customer
 *     tags: [Customer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Customer deleted successfully
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
 *                   example: "Customer deleted successfully"
 *                 data:
 *                   type: object
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", requireSignIn, deleteCustomer);
router.post("/:id/address", requireSignIn, addCustomerAddress);
router.post("/:id/contact", requireSignIn, addCustomerContact);

export default router;