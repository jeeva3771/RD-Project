import express from "express";
import {
    createShiftTime,
    deleteShiftTime,
    getAllShiftTimes,
    updateShiftTime,
} from "../../controllers/masters/shiftTimeController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Shift Time
 *   description: Shift Time Master Management APIs
 */

/**
 * @swagger
 * /shifttime/get-all:
 *   get:
 *     summary: Get all shift times
 *     tags: [Shift Time]
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
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, start time, or end time
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order by name
 *     responses:
 *       200:
 *         description: List of shift times
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 totalCount:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       start_time:
 *                         type: string
 *                       end_time:
 *                         type: string
 *                       is_active:
 *                         type: boolean
 *                       created_by:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                       created_at:
 *                         type: string
 */
router.get("/get-all", requireSignIn, getAllShiftTimes);

/**
 * @swagger
 * /shifttime/create:
 *   post:
 *     summary: Create a new shift time
 *     tags: [Shift Time]
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
 *               - start_time
 *               - end_time
 *             properties:
 *               name:
 *                 type: string
 *               start_time:
 *                 type: string
 *               end_time:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Shift time created successfully
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
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     start_time:
 *                       type: string
 *                     end_time:
 *                       type: string
 *                     is_active:
 *                       type: boolean
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: Shift time name already exists
 */
router.post("/create", requireSignIn, createShiftTime);

/**
 * @swagger
 * /shifttime/update/{id}:
 *   put:
 *     summary: Update a shift time
 *     tags: [Shift Time]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Shift time ID (nanoid)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               start_time:
 *                 type: string
 *               end_time:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Shift time updated successfully
 *       404:
 *         description: Shift time not found
 *       409:
 *         description: Shift time name already exists
 */
router.put("/update/:id", requireSignIn, updateShiftTime);

/**
 * @swagger
 * /shifttime/delete/{id}:
 *   delete:
 *     summary: Delete a shift time
 *     tags: [Shift Time]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Shift time ID (nanoid)
 *     responses:
 *       200:
 *         description: Shift time deleted successfully
 *       404:
 *         description: Shift time not found
 */
router.delete("/delete/:id", requireSignIn, deleteShiftTime);

export default router;
