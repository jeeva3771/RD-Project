import express from "express";
import {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
} from "../../controllers/masters/roleController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireSignIn, getAllRoles);
router.get("/:id", requireSignIn, getRoleById);
router.post("/", requireSignIn, createRole);
router.put("/:id", requireSignIn, updateRole);
router.delete("/:id", requireSignIn, deleteRole);

export default router;
