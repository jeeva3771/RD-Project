import express from "express";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  bulkUploadUsers,
  getUserCounts,
} from "../../controllers/users/userController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";
import upload from "../../middleware/multer.js";

const router = express.Router();

/**
 * @swagger
 * /user:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Return list of all users
 */
router.get("/", requireSignIn, getAllUsers);
router.get("/counts", requireSignIn, getUserCounts);

/**
 * @swagger
 * /user/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 */
router.get("/:id", requireSignIn, getUserById);

/**
 * @swagger
 * /user:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - username
 *               - password
 *               - department_id
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               username:
 *                 type: string
 *                 example: "john123"
 *               password:
 *                 type: string
 *                 example: "Password@123"
 *               department_id:
 *                 type: integer
 *                 example: 5
 *               role:
 *                 type: string
 *                 example: "admin executive"
 *               is_active:
 *                 type: boolean
 *                 example: true
 *               is_head:
 *                 type: boolean
 *                 example: false
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error
 */
router.post("/", upload.single('image'), requireSignIn, createUser);

/**
 * @swagger
 * /user/{id}:
 *   put:
 *     summary: Update user details
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Name"
 *               username:
 *                 type: string
 *                 example: "updated123"
 *               password:
 *                 type: string
 *                 example: "NewPassword@123"
 *               department_id:
 *                 type: integer
 *                 example: 3
 *               role:
 *                 type: string
 *                 example: "manager"
 *               is_active:
 *                 type: boolean
 *                 example: false
 *               is_head:
 *                 type: boolean
 *                 example: true
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 */
router.put("/:id", upload.single('image'), requireSignIn, updateUser);

/**
 * @swagger
 * /user/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */
router.delete("/:id", requireSignIn, deleteUser);

router.post("/bulk-upload", upload.single('file'), requireSignIn, bulkUploadUsers);

export default router;
