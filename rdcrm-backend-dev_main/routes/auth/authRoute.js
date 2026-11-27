import express from "express";
import {
  loginController,
  sessionService,
} from "../../controllers/auth/authController.js";
import { isAdmin, requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "john123"
 *               password:
 *                 type: string
 *                 example: "Password@123"
 *     responses:
 *       200:
 *         description: Login successful
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
 *                   example: "Login successful."
 *                 user:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: "John Doe"
 *                     role:
 *                       type: string
 *                       example: "admin executive"
 *                     permission:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["read", "write", "delete"]
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: Username and password are required
 *       401:
 *         description: Invalid credentials
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post("/login", loginController);

router.post("/session-service", sessionService);

/**
 * @swagger
 * /auth/userdashboard:
 *   get:
 *     summary: Access user dashboard
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User dashboard access granted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Unauthorized - Authentication required
 */
router.get("/userdashboard", requireSignIn, (req, res) => {
  res.status(200).send({ ok: true });
});

/**
 * @swagger
 * /auth/admindashboard:
 *   get:
 *     summary: Access admin dashboard
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin dashboard access granted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get("/admindashboard", requireSignIn, isAdmin, (req, res) => {
  res.status(200).send({ ok: true });
});

export default router;