import OriginMaster from "../../../models/masters/enquiryFlow/originMasterModel.js";

// 1. Get All Origins (Paginated with Search & Filter)
export const getAllOrigins = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";

    const query = {};
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (typeof req.query.is_active !== "undefined" && req.query.is_active !== "") {
      query.is_active = req.query.is_active === "true" || req.query.is_active === true;
    }

    const sortKey = req.query.sortKey || "createdAt";
    const sortDir = req.query.sortDir === "asc" ? 1 : -1;

    const totalCount = await OriginMaster.countDocuments(query);
    const data = await OriginMaster.find(query)
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
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 2. Get Active Origins (For Dropdown / Enquiry Form)
export const getActiveOrigins = async (req, res) => {
  try {
    const data = await OriginMaster.find({ is_active: true }).sort({ name: 1 }).lean();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 3. Get Origin by ID
export const getOriginById = async (req, res) => {
  try {
    const item = await OriginMaster.findById(req.params.id)
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .lean();
    if (!item) {
      return res.status(404).json({ success: false, message: "Origin not found" });
    }
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 4. Create Origin
export const createOrigin = async (req, res) => {
  try {
    const { name, icon, is_active } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Origin name is required" });
    }

    const existing = await OriginMaster.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: "Origin with this name already exists" });
    }

    const item = new OriginMaster({
      name: name.trim(),
      icon: icon || "💬",
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user?._id,
    });

    await item.save();
    res.status(201).json({ success: true, message: "Origin created successfully", data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 5. Update Origin
export const updateOrigin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, is_active } = req.body;

    if (name) {
      const existing = await OriginMaster.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(400).json({ success: false, message: "Origin with this name already exists" });
      }
    }

    const updatePayload = {
      ...(name && { name: name.trim() }),
      ...(icon !== undefined && { icon }),
      ...(is_active !== undefined && { is_active }),
      updated_by: req.user?._id,
    };

    const updated = await OriginMaster.findByIdAndUpdate(id, updatePayload, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Origin not found" });
    }

    res.status(200).json({ success: true, message: "Origin updated successfully", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 6. Delete Origin
export const deleteOrigin = async (req, res) => {
  try {
    const deleted = await OriginMaster.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Origin not found" });
    }
    res.status(200).json({ success: true, message: "Origin deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const originMasterController = {
  getAll: getAllOrigins,
  getActive: getActiveOrigins,
  getById: getOriginById,
  create: createOrigin,
  update: updateOrigin,
  deleteItem: deleteOrigin,
};

export default originMasterController;
