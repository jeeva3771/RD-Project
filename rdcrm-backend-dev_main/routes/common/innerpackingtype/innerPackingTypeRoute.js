import express from "express";
import {
  getAllInnerPackingTypes,
  getInnerPackingTypeById,
  createInnerPackingType,
  updateInnerPackingType,
  deleteInnerPackingType
} from "../../../controllers/common/innerPackingTypeController.js";
import { requireSignIn } from "../../../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireSignIn, getAllInnerPackingTypes);
router.get("/:id", requireSignIn, getInnerPackingTypeById);
router.post("/", requireSignIn, createInnerPackingType);
router.put("/:id", requireSignIn, updateInnerPackingType);
router.delete("/:id", requireSignIn, deleteInnerPackingType);

export default router;