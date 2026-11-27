import companyModel from "../../models/masters/companyModel.js";

// Create Company
export const createCompany = async (req, res) => {
  try {
    const { company_name, is_active } = req.body;

    if (!company_name) {
      return res.status(400).json({ success: false, message: "Company Name is required" });
    }

    const existingCompany = await companyModel.findOne({
      company_name: { $regex: new RegExp(`^${company_name}$`, "i") },
    });

    if (existingCompany) {
      return res.status(400).json({ success: false, message: "Company Name already exists" });
    }

    const company = new companyModel({
      company_name,
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user?._id,
    });

    await company.save();
    res.status(201).json({ success: true, message: "Company created successfully", data: company });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get All Companies
export const getAllCompanies = async (req, res) => {
  try {
    const { search, is_active } = req.query;
    let query = {};

    if (search) {
      query.company_name = { $regex: search, $options: "i" };
    }

    if (is_active === "true") {
      query.is_active = true;
    } else if (is_active === "false") {
      query.is_active = false;
    }

    const page = Math.max(1, parseInt(req.query.page));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit)));
    const skip = (page - 1) * limit;

    const sortKey = req.query.sortKey || "createdAt";
    let sortDir = req.query.sortDir === "asc" ? 1 : -1;

    // Make Active (true/2) come first when sorted ascending
    if (sortKey === "is_active") {
      sortDir = sortDir === 1 ? -1 : 1;
    }

    const companies = await companyModel
      .find(query)
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .sort({ [sortKey]: sortDir })
      .skip(skip)
      .limit(limit);

    const total = await companyModel.countDocuments(query);

    res.status(200).json({
      success: true,
      data: companies,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalCount: total,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Company by ID
export const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await companyModel.findById(id);

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    res.status(200).json({ success: true, data: company });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Company
export const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { company_name, is_active } = req.body;

    const existingCompany = await companyModel.findOne({
      company_name: { $regex: new RegExp(`^${company_name}$`, "i") },
      _id: { $ne: id },
    });

    if (existingCompany) {
      return res.status(400).json({ success: false, message: "Company Name already exists" });
    }

    const company = await companyModel.findByIdAndUpdate(
      id,
      {
        company_name,
        is_active,
        updated_by: req.user?._id,
      },
      { new: true }
    );

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    res.status(200).json({ success: true, message: "Company updated successfully", data: company });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Company
export const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await companyModel.findByIdAndDelete(id);

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    res.status(200).json({ success: true, message: "Company deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
