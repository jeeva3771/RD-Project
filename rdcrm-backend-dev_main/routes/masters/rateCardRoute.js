import express from "express";
import {
  getAllRateCards,
  getRateCardById,
  getRateCardsByProcessId,
  createRateCard,
  updateRateCard,
  deleteRateCard,
  checkRateCardExists
} from "../../controllers/masters/rateCardController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /ratecard/check-exists:
 *   get:
 *     summary: Check if rate card exists for a process
 *     tags: [RateCard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: process_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Process ID (ObjectId)
 *         example: "507f1f77bcf86cd799439011"
 *       - in: query
 *         name: is_internal
 *         schema:
 *           type: boolean
 *         description: Whether the rate card is internal
 *         example: true
 *       - in: query
 *         name: vendor
 *         schema:
 *           type: string
 *         description: Vendor ID (ObjectId) - required when is_internal is false
 *         example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Rate card existence check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 exists:
 *                   type: boolean
 *                   example: false
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "abc123def4567890"
 *                     process_id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439011"
 *                     is_internal:
 *                       type: boolean
 *                       example: true
 *                     vendor:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439012"
 *       400:
 *         description: Process ID is required or Invalid ID format
 *       500:
 *         description: Internal server error
 */
router.get('/check-exists', requireSignIn, checkRateCardExists);

/**
 * @swagger
 * /ratecard:
 *   get:
 *     summary: Get all rate cards with pagination and filtering
 *     tags: [RateCard]
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
 *         description: Search by name
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: process_id
 *         schema:
 *           type: string
 *         description: Filter by process ID
 *         example: "507f1f77bcf86cd799439011"
 *       - in: query
 *         name: sortField
 *         schema:
 *           type: string
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
 *         description: List of rate cards retrieved successfully
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
router.get("/", requireSignIn, getAllRateCards);

/**
 * @swagger
 * /ratecard/{id}:
 *   get:
 *     summary: Get rate card by ID
 *     tags: [RateCard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Rate card ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Rate card details retrieved successfully
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
 *                   example: "Rate card fetched successfully"
 *                 data:
 *                   type: object
 *       404:
 *         description: Rate card not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", requireSignIn, getRateCardById);

/**
 * @swagger
 * /ratecard/process/{processId}:
 *   get:
 *     summary: Get all rate cards for a specific process
 *     tags: [RateCard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: processId
 *         required: true
 *         schema:
 *           type: string
 *         description: Process ID (ObjectId)
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Rate cards for process retrieved successfully
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
 *                   example: "Rate cards fetched successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Internal server error
 */
router.get("/process/:processId", requireSignIn, getRateCardsByProcessId);

/**
 * @swagger
 * /ratecard:
 *   post:
 *     summary: Create a new rate card
 *     tags: [RateCard]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - process_id
 *             properties:
 *               process_id:
 *                 type: string
 *                 description: Process ID (ObjectId)
 *                 example: "507f1f77bcf86cd799439011"
 *               rate_unit:
 *                 type: string
 *                 example: "per_hour"
 *               variable_rates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - price
 *                   properties:
 *                     price:
 *                       type: number
 *                       minimum: 0
 *                       example: 150.50
 *                     variable_key:
 *                       type: string
 *                       example: "material_type"
 *                     variable_value:
 *                       type: string
 *                       example: "plastic"
 *                 example: [
 *                   {
 *                     "price": 150.50,
 *                     "material_type": "plastic",
 *                     "size": "medium"
 *                   }
 *                 ]
 *               is_internal:
 *                 type: boolean
 *                 default: false
 *                 example: false
 *               vendor:
 *                 type: string
 *                 description: Vendor ID (ObjectId) - required when is_internal is false
 *                 example: "507f1f77bcf86cd799439012"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *               remarks:
 *                 type: string
 *                 example: "Standard rate for plastic materials"
 *     responses:
 *       201:
 *         description: Rate card created successfully
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
 *                   example: "Rate card created successfully"
 *                 data:
 *                   type: object
 *       400:
 *         description: Validation error (Process ID required, Vendor required for external, Invalid variable rates)
 *       401:
 *         description: Unauthorized - User ID not found
 *       404:
 *         description: Process or Vendor not found
 *       409:
 *         description: Rate card already exists for this process/vendor combination
 *       500:
 *         description: Internal server error
 */
router.post("/", requireSignIn, createRateCard);

/**
 * @swagger
 * /ratecard/{id}:
 *   put:
 *     summary: Update rate card details
 *     tags: [RateCard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Rate card ID (nanoid)
 *         example: "abc123def4567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rate_unit:
 *                 type: string
 *                 example: "per_day"
 *               variable_rates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - price
 *                   properties:
 *                     price:
 *                       type: number
 *                       minimum: 0
 *                       example: 200.75
 *                 example: [
 *                   {
 *                     "price": 200.75,
 *                     "material_type": "metal",
 *                     "size": "large"
 *                   }
 *                 ]
 *               is_active:
 *                 type: boolean
 *                 example: false
 *               remarks:
 *                 type: string
 *                 example: "Updated pricing for metal materials"
 *             description: "Note: process_id, is_internal, and vendor cannot be changed after creation"
 *     responses:
 *       200:
 *         description: Rate card updated successfully
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
 *                   example: "Rate card updated successfully"
 *                 data:
 *                   type: object
 *       400:
 *         description: Validation error (Process ID, Internal type, or Vendor cannot be changed; Invalid variable rates)
 *       401:
 *         description: Unauthorized - User ID not found
 *       404:
 *         description: Rate card not found
 *       500:
 *         description: Internal server error
 */
router.put("/:id", requireSignIn, updateRateCard);

/**
 * @swagger
 * /ratecard/{id}:
 *   delete:
 *     summary: Delete a rate card
 *     tags: [RateCard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Rate card ID (nanoid)
 *         example: "abc123def4567890"
 *     responses:
 *       200:
 *         description: Rate card deleted successfully
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
 *                   example: "Rate card deleted successfully"
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized - User ID not found
 *       404:
 *         description: Rate card not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", requireSignIn, deleteRateCard);// Check if rate card exists (place this BEFORE /:id routes to avoid conflicts)

export default router;