import ReadyTrophyMaster from "../../../models/masters/enquiryFlow/readyTrophyMasterModel.js";

// 1. Get All Ready Trophies (Paginated with Search & Filter)
export const getAllReadyTrophies = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";

    const query = {};
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
      ];
    }

    if (typeof req.query.is_active !== "undefined" && req.query.is_active !== "") {
      query.is_active = req.query.is_active === "true" || req.query.is_active === true;
    }

    const sortKey = req.query.sortKey || "createdAt";
    const sortDir = req.query.sortDir === "asc" ? 1 : -1;

    const totalCount = await ReadyTrophyMaster.countDocuments(query);
    const data = await ReadyTrophyMaster.find(query)
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

// 2. Get Active Ready Trophies (For Enquiry Form Ready Products Grid)
export const getActiveReadyTrophies = async (req, res) => {
  try {
    const data = await ReadyTrophyMaster.find({ is_active: true }).sort({ code: 1 }).lean();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 3. Get Ready Trophy by ID
export const getReadyTrophyById = async (req, res) => {
  try {
    const item = await ReadyTrophyMaster.findById(req.params.id)
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .lean();
    if (!item) {
      return res.status(404).json({ success: false, message: "Ready trophy not found" });
    }
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 4. Create Ready Trophy
export const createReadyTrophy = async (req, res) => {
  try {
    const { code, name, icon, rate, sizes, is_active } = req.body;
    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: "Product code is required" });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Product name is required" });
    }

    const existing = await ReadyTrophyMaster.findOne({
      code: { $regex: new RegExp(`^${code.trim()}$`, "i") },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: "Product with this code already exists" });
    }

    let parsedSizes = [];
    if (Array.isArray(sizes)) {
      parsedSizes = sizes;
    } else if (typeof sizes === "string" && sizes.trim()) {
      try {
        parsedSizes = JSON.parse(sizes);
      } catch {
        parsedSizes = [];
      }
    }

    const item = new ReadyTrophyMaster({
      code: code.trim(),
      name: name.trim(),
      icon: icon || "🏆",
      rate: Number(rate) || 0,
      sizes: parsedSizes,
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user?._id,
    });

    await item.save();
    res.status(201).json({ success: true, message: "Ready trophy created successfully", data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 5. Update Ready Trophy
export const updateReadyTrophy = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, icon, rate, sizes, is_active } = req.body;

    if (code) {
      const existing = await ReadyTrophyMaster.findOne({
        code: { $regex: new RegExp(`^${code.trim()}$`, "i") },
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(400).json({ success: false, message: "Product with this code already exists" });
      }
    }

    let parsedSizes = sizes;
    if (typeof sizes === "string" && sizes.trim()) {
      try {
        parsedSizes = JSON.parse(sizes);
      } catch {
        // keep as is
      }
    }

    const updatePayload = {
      ...(code && { code: code.trim() }),
      ...(name && { name: name.trim() }),
      ...(icon !== undefined && { icon }),
      ...(rate !== undefined && { rate: Number(rate) }),
      ...(parsedSizes !== undefined && { sizes: parsedSizes }),
      ...(is_active !== undefined && { is_active }),
      updated_by: req.user?._id,
    };

    const updated = await ReadyTrophyMaster.findByIdAndUpdate(id, updatePayload, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Ready trophy not found" });
    }

    res.status(200).json({ success: true, message: "Ready trophy updated successfully", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 6. Delete Ready Trophy
export const deleteReadyTrophy = async (req, res) => {
  try {
    const deleted = await ReadyTrophyMaster.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Ready trophy not found" });
    }
    res.status(200).json({ success: true, message: "Ready trophy deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const readyTrophyMasterController = {
  getAll: getAllReadyTrophies,
  getActive: getActiveReadyTrophies,
  getById: getReadyTrophyById,
  create: createReadyTrophy,
  update: updateReadyTrophy,
  deleteItem: deleteReadyTrophy,
};

export default readyTrophyMasterController;
