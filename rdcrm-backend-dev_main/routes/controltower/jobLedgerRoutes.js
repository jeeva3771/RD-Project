import express from "express";
import { getJobLedgerList, getJobLedgerByJobNo } from "../../controllers/controltower/jobLedgerController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

router.get("/jobs", requireSignIn, getJobLedgerList);
router.get("/:jobNo", requireSignIn, getJobLedgerByJobNo);

export default router;
