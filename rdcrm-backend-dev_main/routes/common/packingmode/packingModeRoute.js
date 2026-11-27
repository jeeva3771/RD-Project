import express from "express";
import {
  getAllPackingModes,
  getPackingModeById,
  createPackingMode,
  updatePackingMode,
  deletePackingMode
} from "../../../controllers/common/PackingModeController.js";
import { requireSignIn } from "../../../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireSignIn, getAllPackingModes);
router.get("/:id", requireSignIn, getPackingModeById);
router.post("/", requireSignIn, createPackingMode);
router.put("/:id", requireSignIn, updatePackingMode);
router.delete("/:id", requireSignIn, deletePackingMode);

export default router;