import express from "express";
import {
  getAllProcessColumns,
  getProcessColumnById,
  createProcessColumn,
  updateProcessColumn,
  deleteProcessColumn,
} from "../../controllers/masters/processColumnController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireSignIn, getAllProcessColumns);
router.get("/:id", requireSignIn, getProcessColumnById);
router.post("/", requireSignIn, createProcessColumn);
router.put("/:id", requireSignIn, updateProcessColumn);
router.delete("/:id", requireSignIn, deleteProcessColumn);

export default router;
