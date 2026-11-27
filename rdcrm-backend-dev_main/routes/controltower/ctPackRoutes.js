import express from "express";
import { requireSignIn } from "../../middleware/authMiddleware.js";
import upload from "../../middleware/multer.js";
import { getCtPackJobs, packJob, updateCtPackJob, downloadDispatchFiles, updateDispatchStatus } from "../../controllers/controltower/ctPackController.js";

const router = express.Router();

router.get("/", requireSignIn, getCtPackJobs);
router.post("/:id/pack", requireSignIn, packJob);
router.patch("/:id", requireSignIn, upload.any(), updateCtPackJob);
router.get("/:id/download-dispatch", requireSignIn, downloadDispatchFiles);
router.patch("/:id/dispatch-status", requireSignIn, upload.any(), updateDispatchStatus);

export default router;
