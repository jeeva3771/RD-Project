import AttachmentMaster from "../../../models/masters/enquiryFlow/attachmentMasterModel.js";

export const getAll = async (req, res) => {
  try {

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";
    const type = req.query.type?.trim();
    const product = req.query.product?.trim();

    const query = {};
    if (search) query.name = { $regex: search, $options: "i" };
    if (type) query.type = type;
    if (product) query.applicable_products = { $in: [product, "all"] };
    if (typeof req.query.is_active !== "undefined" && req.query.is_active !== "") {
      query.is_active = req.query.is_active === "true" || req.query.is_active === true;
    }

    const sortKey = req.query.sortKey || "type";
    const sortDir = req.query.sortDir === "desc" ? -1 : 1;

    const totalCount = await AttachmentMaster.countDocuments(query);
    const data = await AttachmentMaster.find(query)
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
    const { type, product } = req.query;
    const query = { is_active: true };
    if (type) query.type = type;
    if (product) query.applicable_products = { $in: [product, "all"] };

    const data = await AttachmentMaster.find(query).sort({ type: 1, name: 1 }).lean();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getById = async (req, res) => {
  try {
    const data = await AttachmentMaster.findById(req.params.id)
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .lean();
    if (!data) return res.status(404).json({ success: false, message: "Attachment not found" });
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const create = async (req, res) => {
  try {
    const { name, type } = req.body;
    if (!name || !type) return res.status(400).json({ success: false, message: "Name and Type are required" });

    const newDoc = new AttachmentMaster({
      ...req.body,
      created_by: req.user?._id || null,
      updated_by: req.user?._id || null,
    });

    await newDoc.save();
    res.status(201).json({ success: true, message: "Attachment created successfully", data: newDoc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const update = async (req, res) => {
  try {
    const updated = await AttachmentMaster.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updated_by: req.user?._id || null },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: "Attachment not found" });
    res.status(200).json({ success: true, message: "Attachment updated successfully", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteItem = async (req, res) => {
  try {
    const deleted = await AttachmentMaster.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Attachment not found" });
    res.status(200).json({ success: true, message: "Attachment deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default { getAll, getActive, getById, create, update, deleteItem };
