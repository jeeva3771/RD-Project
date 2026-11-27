import ProcessMaster from "../../../models/masters/enquiryFlow/processMasterModel.js";

export const getAll = async (req, res) => {
  try {

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";
    const category = req.query.category?.trim();
    const product = req.query.product?.trim();

    const query = {};
    if (search) query.name = { $regex: search, $options: "i" };
    if (category) query.category = category;
    if (product) query.applicable_products = { $in: [product, "all"] };
    if (typeof req.query.is_active !== "undefined" && req.query.is_active !== "") {
      query.is_active = req.query.is_active === "true" || req.query.is_active === true;
    }

    const sortKey = req.query.sortKey || "createdAt";
    const sortDir = req.query.sortDir === "asc" ? 1 : -1;

    const totalCount = await ProcessMaster.countDocuments(query);
    const data = await ProcessMaster.find(query)
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .sort({ [sortKey]: sortDir })
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
    const { category, product } = req.query;
    const query = { is_active: true };
    if (category) query.category = category;
    if (product) query.applicable_products = { $in: [product, "all"] };

    const data = await ProcessMaster.find(query).sort({ category: 1, name: 1 }).lean();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getById = async (req, res) => {
  try {
    const data = await ProcessMaster.findById(req.params.id)
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .lean();
    if (!data) return res.status(404).json({ success: false, message: "Process master not found" });
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const create = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Process name is required" });

    const newDoc = new ProcessMaster({
      ...req.body,
      created_by: req.user?._id || null,
      updated_by: req.user?._id || null,
    });

    await newDoc.save();
    res.status(201).json({ success: true, message: "Process master created successfully", data: newDoc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const update = async (req, res) => {
  try {
    const updated = await ProcessMaster.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updated_by: req.user?._id || null },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: "Process master not found" });
    res.status(200).json({ success: true, message: "Process master updated successfully", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteItem = async (req, res) => {
  try {
    const deleted = await ProcessMaster.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Process master not found" });
    res.status(200).json({ success: true, message: "Process master deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default { getAll, getActive, getById, create, update, deleteItem };
