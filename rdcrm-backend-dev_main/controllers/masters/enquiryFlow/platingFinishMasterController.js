import PlatingFinishMaster from "../../../models/masters/enquiryFlow/platingFinishMasterModel.js";

export const getAll = async (req, res) => {
  try {

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";
    const product = req.query.product?.trim();

    const query = {};
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    if (product) {
      query.$or = [
        { applicable_products: { $in: [product, "all"] } },
        { applicable_products: { $exists: false } },
        { applicable_products: { $size: 0 } },
      ];
    }
    if (typeof req.query.is_active !== "undefined" && req.query.is_active !== "") {
      query.is_active = req.query.is_active === "true" || req.query.is_active === true;
    }

    const sortKey = req.query.sortKey || "sort_order";
    const sortDir = req.query.sortDir === "desc" ? -1 : 1;

    const totalCount = await PlatingFinishMaster.countDocuments(query);
    const data = await PlatingFinishMaster.find(query)
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .sort({ [sortKey]: sortDir, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      data,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
      currentPage: page,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getActive = async (req, res) => {
  try {
    const { product } = req.query;
    const query = { is_active: true };
    if (product) {
      query.$or = [
        { applicable_products: { $in: [product, "all"] } },
        { applicable_products: { $exists: false } },
        { applicable_products: { $size: 0 } },
      ];
    }

    const data = await PlatingFinishMaster.find(query).sort({ sort_order: 1, name: 1 }).lean();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getById = async (req, res) => {
  try {
    const data = await PlatingFinishMaster.findById(req.params.id)
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .lean();

    if (!data) return res.status(404).json({ success: false, message: "Plating finish not found" });
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const create = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Plating finish name is required" });

    const newDoc = new PlatingFinishMaster({
      ...req.body,
      created_by: req.user?._id || null,
      updated_by: req.user?._id || null,
    });

    await newDoc.save();
    res.status(201).json({ success: true, message: "Plating finish created successfully", data: newDoc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await PlatingFinishMaster.findByIdAndUpdate(
      id,
      { ...req.body, updated_by: req.user?._id || null },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: "Plating finish not found" });
    res.status(200).json({ success: true, message: "Plating finish updated successfully", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteItem = async (req, res) => {
  try {
    const deleted = await PlatingFinishMaster.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Plating finish not found" });
    res.status(200).json({ success: true, message: "Plating finish deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default { getAll, getActive, getById, create, update, deleteItem };
