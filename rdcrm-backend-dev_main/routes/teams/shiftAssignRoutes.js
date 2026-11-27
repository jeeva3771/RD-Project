import express from 'express';
import {
    bulkAssignShift,
    getShiftRosterOverview,
    viewUserShiftDetails,
    getShiftAssignmentHistory,
    getUsersForTeamBuilder,
    updateShiftAssignment,
    deactivateShiftAssignment,
    getDepartmentShiftSummary
} from '../../controllers/teams/shiftAssignController.js';
import { requireSignIn } from '../../middleware/authMiddleware.js'; 

const router = express.Router();

router.post('/bulk-assign', requireSignIn, bulkAssignShift);

router.get('/overview', requireSignIn, getShiftRosterOverview);

router.get('/view/:userId', requireSignIn, viewUserShiftDetails);

router.get('/history/:userId', requireSignIn, getShiftAssignmentHistory);

router.put('/update/:assignmentId', requireSignIn, updateShiftAssignment);

router.delete('/deactivate/:assignmentId', requireSignIn, deactivateShiftAssignment);

router.get('/department-summary/:departmentId', requireSignIn, getDepartmentShiftSummary);

// TEAM BUILDER ROUTES 

router.get('/team-builder/users', requireSignIn, getUsersForTeamBuilder);

export default router;