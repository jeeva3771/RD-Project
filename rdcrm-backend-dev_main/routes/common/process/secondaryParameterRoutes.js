import express from "express";
import {
  getAllSecondaryParameters,
  getSecondaryParameterById,
  createSecondaryParameter,
  updateSecondaryParameter,
  deleteSecondaryParameter,
} from "../../../controllers/common/Process/secondaryParameterController.js";
import { requireSignIn } from "../../../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireSignIn, getAllSecondaryParameters);
router.get("/:id", requireSignIn, getSecondaryParameterById);
router.post("/", requireSignIn, createSecondaryParameter);
router.put("/:id", requireSignIn, updateSecondaryParameter);
router.delete("/:id", requireSignIn, deleteSecondaryParameter);

export default router;
