import express from "express";
import { requireSignIn } from "../../middleware/authMiddleware.js";
import {
    createTeam,
    getAllTeams,
    getTeamById,
    updateTeam,
    deleteTeam,
    removeMember,
} from "../../controllers/teams/teamController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Teams
 *   description: Team Management APIs
 */

/**
 * @swagger
 * /teams/create:
 *   post:
 *     summary: Create a new team
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - team_name
 *               - department_id
 *             properties:
 *               team_name:
 *                 type: string
 *               shift_timing:
 *                 type: string
 *               department_id:
 *                 type: string
 *               member_list:
 *                 type: array
 *                 items:
 *                   type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Team created successfully
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
 *                       description: Generated nanoid
 *                     code:
 *                       type: string
 *                       description: Generated team code
 *                     team_name:
 *                       type: string
 *                     department_id:
 *                       type: string
 *                     member_list:
 *                       type: array
 *                       items:
 *                         type: string
 *                     is_active:
 *                       type: boolean
 */
router.post("/create", requireSignIn, createTeam);

/**
 * @swagger
 * /teams:
 *   get:
 *     summary: Get all teams
 *     tags: [Teams]
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
 *         description: Items per page
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by team name
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of all teams
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       id:
 *                         type: string
 *                       code:
 *                         type: string
 *                       team_name:
 *                         type: string
 *                       department_id:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                       member_list:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             name:
 *                               type: string
 *                             emp_id:
 *                               type: string
 *                             email:
 *                               type: string
 *                       is_active:
 *                         type: boolean
 *                 total:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 */
router.get("/", requireSignIn, getAllTeams);

/**
 * @swagger
 * /teams/{id}:
 *   get:
 *     summary: Get team by ID
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Team ID (nanoid)
 *     responses:
 *       200:
 *         description: Team details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     code:
 *                       type: string
 *                     team_name:
 *                       type: string
 *                     department_id:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                     member_list:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           emp_id:
 *                             type: string
 *                           email:
 *                             type: string
 *       404:
 *         description: Team not found
 */
router.get("/:id", requireSignIn, getTeamById);

/**
 * @swagger
 * /teams/{id}:
 *   put:
 *     summary: Update team details
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               team_name:
 *                 type: string
 *               shift_timing:
 *                 type: string
 *               department_id:
 *                 type: string
 *               member_list:
 *                 type: array
 *                 items:
 *                   type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Team updated successfully
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
 */
router.put("/:id", requireSignIn, updateTeam);

/**
 * @swagger
 * /teams/{id}:
 *   delete:
 *     summary: Delete a team
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Team deleted successfully
 */
router.delete("/:id", requireSignIn, deleteTeam);

/**
 * @swagger
 * /teams/remove-member/{id}:
 *   put:
 *     summary: Remove a member from a team
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Team ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the user to remove
 *     responses:
 *       200:
 *         description: Member removed successfully
 */
router.put("/remove-member/:id", requireSignIn, removeMember);

export default router;
