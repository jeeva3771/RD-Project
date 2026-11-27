import TaxMaster from "../../models/masters/taxMasterModel.js";
import vendorModel from "../../models/masters/vendorModel.js";
import outsourceVendorModel from "../../models/masters/outsourceVendorModel.js";

/**
 * GET /taxmaster — List all taxes with server-side pagination
 */
export const getTaxList = async (req, res) => {
  try {
    const { type, status, search } = req.query;
    const filter = {};

    if (type && type !== "all") {
      filter.tax_type = type;
    }

    if (status !== undefined && status !== "" && status !== "all") {
      filter.is_active = status === "true" || status === true || status === "active";
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { tax_name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];
    }

    const total = await TaxMaster.countDocuments(filter);

    // Check if client requested unpaginated data (e.g. limit=all)
    const isUnpaginated = req.query.limit === "all" || req.query.paginate === "false";
    if (isUnpaginated) {
      const taxes = await TaxMaster.find(filter).sort({ tax_type: 1, tax_rate: 1, createdAt: -1 }).lean();
      return res.status(200).json({
        success: true,
        count: taxes.length,
        total,
        page: 1,
        limit: taxes.length,
        totalPages: 1,
        data: taxes,
      });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = parseInt(req.query.limit) > 0 ? Math.min(100, parseInt(req.query.limit)) : 10;
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit) || 1;

    const taxes = await TaxMaster.find(filter)
      .sort({ tax_type: 1, tax_rate: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      count: taxes.length,
      total,
      page,
      limit,
      totalPages,
      data: taxes,
    });
  } catch (err) {
    console.error("Error in getTaxList:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /taxmaster/:id — Get tax by ID
 */
export const getTaxById = async (req, res) => {
  try {
    const tax = await TaxMaster.findById(req.params.id).lean();
    if (!tax) {
      return res.status(404).json({ success: false, message: "Tax record not found" });
    }
    return res.status(200).json({ success: true, data: tax });
  } catch (err) {
    console.error("Error in getTaxById:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /taxmaster — Create new tax
 */
export const createTax = async (req, res) => {
  try {
    const { tax_name, tax_type, tax_rate, description, is_active } = req.body;

    if (!tax_name || !tax_name.trim()) {
      return res.status(400).json({ success: false, message: "Tax Name is required" });
    }
    if (tax_rate === undefined || tax_rate === null || isNaN(Number(tax_rate))) {
      return res.status(400).json({ success: false, message: "Valid Tax Rate percentage is required" });
    }

    const rateNum = Number(tax_rate);
    if (rateNum < 0) {
      return res.status(400).json({ success: false, message: "Tax Rate percentage cannot be negative" });
    }

    const creatorId = req.user?._id || req.user?.id || null;
    const creatorName = req.user?.name || req.user?.username || req.body?.created_by_name || "Admin";

    const newTax = await TaxMaster.create({
      tax_name: tax_name.trim(),
      tax_type: tax_type || "GST",
      tax_rate: rateNum,
      description: (description || "").trim(),
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      created_by: creatorId,
      created_by_name: creatorName,
    });

    return res.status(201).json({
      success: true,
      message: `Tax "${newTax.tax_name}" created successfully`,
      data: newTax,
    });
  } catch (err) {
    console.error("Error in createTax:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /taxmaster/:id — Update existing tax
 */
export const updateTax = async (req, res) => {
  try {
    const { tax_name, tax_type, tax_rate, description, is_active } = req.body;

    const tax = await TaxMaster.findById(req.params.id);
    if (!tax) {
      return res.status(404).json({ success: false, message: "Tax record not found" });
    }

    if (tax_name !== undefined) tax.tax_name = tax_name.trim();
    if (tax_type !== undefined) tax.tax_type = tax_type;
    if (tax_rate !== undefined) {
      const rateNum = Number(tax_rate);
      if (isNaN(rateNum) || rateNum < 0) {
        return res.status(400).json({ success: false, message: "Tax Rate must be a valid positive number" });
      }
      tax.tax_rate = rateNum;
    }
    if (description !== undefined) tax.description = description.trim();
    if (is_active !== undefined) tax.is_active = Boolean(is_active);

    await tax.save();

    // Automatically sync updated tax rate to all vendors using this tax
    if (tax_rate !== undefined) {
      if (tax.tax_type === "GST") {
        await vendorModel.updateMany({ gst_tax: tax._id }, { $set: { gst_rate: tax.tax_rate } });
        await outsourceVendorModel.updateMany({ gst_tax: tax._id }, { $set: { gst_rate: tax.tax_rate } });
      } else if (tax.tax_type === "TDS") {
        await vendorModel.updateMany({ tds_tax: tax._id }, { $set: { tds_rate: tax.tax_rate } });
        await outsourceVendorModel.updateMany({ tds_tax: tax._id }, { $set: { tds_rate: tax.tax_rate } });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Tax "${tax.tax_name}" updated successfully`,
      data: tax,
    });
  } catch (err) {
    console.error("Error in updateTax:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /taxmaster/:id — Delete tax
 */
export const deleteTax = async (req, res) => {
  try {
    const tax = await TaxMaster.findByIdAndDelete(req.params.id);
    if (!tax) {
      return res.status(404).json({ success: false, message: "Tax record not found" });
    }

    return res.status(200).json({
      success: true,
      message: `Tax "${tax.tax_name}" deleted successfully`,
    });
  } catch (err) {
    console.error("Error in deleteTax:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
