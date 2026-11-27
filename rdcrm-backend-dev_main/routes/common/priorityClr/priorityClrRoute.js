import express from "express";
import { requireSignIn } from "../../../middleware/authMiddleware.js";
import {
  createPriorityClr,
  getAllPriorityClr,
  getPriorityClrById,
  updatePriorityClr,
  deletePriorityClr
} from "../../../controllers/common/priorityClrController.js";

const router = express.Router();

router.post("/", requireSignIn, createPriorityClr);
router.get("/", requireSignIn, getAllPriorityClr);
router.get("/:id", requireSignIn, getPriorityClrById);
router.put("/:id", requireSignIn, updatePriorityClr);
router.delete("/:id", requireSignIn, deletePriorityClr);

export default router;
