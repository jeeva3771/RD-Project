import express from "express";
import { getInventoryLogs, getScrapDisposalList, updateScrapDisposal } from "../../controllers/shopfloor/registerController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

router.get("/logs", requireSignIn, getInventoryLogs);
router.get("/scrap-disposal", requireSignIn, getScrapDisposalList);
router.put("/scrap-disposal/:id", requireSignIn, updateScrapDisposal);

export default router;
