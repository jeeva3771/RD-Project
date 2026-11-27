import express from "express";
import {
  getAllTertiaryParameters,
  getTertiaryParameterById,
  createTertiaryParameter,
  updateTertiaryParameter,
  deleteTertiaryParameter,
} from "../../../controllers/common/Process/tertiaryParameterController.js";
import { requireSignIn } from "../../../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireSignIn, getAllTertiaryParameters);
router.get("/:id", requireSignIn, getTertiaryParameterById);
router.post("/", requireSignIn, createTertiaryParameter);
router.put("/:id", requireSignIn, updateTertiaryParameter);
router.delete("/:id", requireSignIn, deleteTertiaryParameter);

export default router;
