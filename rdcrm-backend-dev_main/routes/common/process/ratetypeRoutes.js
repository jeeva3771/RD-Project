import express from "express";
import {
  getAllRateTypes,
  getRateTypeById,
  createRateType,
  updateRateType,
  deleteRateType,
} from "../../../controllers/common/Process/ratetypeController.js";
import { requireSignIn } from "../../../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireSignIn, getAllRateTypes);
router.get("/:id", requireSignIn, getRateTypeById);
router.post("/", requireSignIn, createRateType);
router.put("/:id", requireSignIn, updateRateType);
router.delete("/:id", requireSignIn, deleteRateType);

export default router;
