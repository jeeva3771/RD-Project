import express from "express";
import {
    assignAssemblyTeamJob,
    getAllAssemblyJobs,
    reassignAssemblyJob,
    acknowledgeDateChange,
    acknowledgeQtyChange,
    reallocateAssemblyJob,
    acknowledgeNotHeadAlert
} from "../../controllers/teams/assemblyTeamController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

router.get("/all", requireSignIn, getAllAssemblyJobs);
router.post("/assign", requireSignIn, assignAssemblyTeamJob);
router.post("/reassign", requireSignIn, reassignAssemblyJob);
router.post("/reallocate", requireSignIn, reallocateAssemblyJob);
router.post("/acknowledge-date", requireSignIn, acknowledgeDateChange);
router.post("/acknowledge-qty", requireSignIn, acknowledgeQtyChange);
router.post("/acknowledge-not-head", requireSignIn, acknowledgeNotHeadAlert);

export default router;