import express from "express";
import { requireSignIn } from "../../middleware/authMiddleware.js";
import {
  createCompany,
  getAllCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
} from "../../controllers/masters/companyController.js";

const router = express.Router();

router.post("/create", requireSignIn, createCompany);
router.get("/get", requireSignIn, getAllCompanies);
router.get("/get/:id", requireSignIn, getCompanyById);
router.put("/update/:id", requireSignIn, updateCompany);
router.delete("/delete/:id", requireSignIn, deleteCompany);

export default router;
