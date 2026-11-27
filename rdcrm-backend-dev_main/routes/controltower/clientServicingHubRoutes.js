import express from "express";
import { getClientServicingCounts, getStationJobsList } from "../../controllers/controltower/clientServicingHubController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

router.get("/counts", requireSignIn, getClientServicingCounts);
router.get("/station-jobs", requireSignIn, getStationJobsList);

export default router;
