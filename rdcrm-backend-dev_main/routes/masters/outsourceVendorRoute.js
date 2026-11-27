import express from "express";
import {
  createOutsourceVendor,
  getAllOutsourceVendors,
  getOutsourceVendorById,
  updateOutsourceVendor,
  deleteOutsourceVendor,
  getOutsourceVendorNameList,
} from "../../controllers/masters/outsourceVendorController.js";
import { requireSignIn } from "../../middleware/authMiddleware.js";

const router = express.Router();

router.get("/namelist", requireSignIn, getOutsourceVendorNameList);
router.get("/", requireSignIn, getAllOutsourceVendors);
router.get("/:id", requireSignIn, getOutsourceVendorById);
router.post("/", requireSignIn, createOutsourceVendor);
router.put("/:id", requireSignIn, updateOutsourceVendor);
router.delete("/:id", requireSignIn, deleteOutsourceVendor);

export default router;
