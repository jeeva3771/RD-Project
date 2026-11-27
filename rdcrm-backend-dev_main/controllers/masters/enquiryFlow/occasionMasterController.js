import OccasionMaster from "../../../models/masters/enquiryFlow/occasionMasterModel.js";

// 1. Get All Occasions (Paginated with Search & Filter)
export const getAllOccasions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";

    const andConditions = [];
    if (search) {
      andConditions.push({
        name: { $regex: search, $options: "i" },
      });
    }

    if (typeof req.query.is_active !== "undefined" && req.query.is_active !== "") {
      andConditions.push({
        is_active: req.query.is_active === "true" || req.query.is_active === true,
      });
    }

    if (req.query.group_id && req.query.group_id !== "all") {
      andConditions.push({ group_id: req.query.group_id });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    const sortKey = req.query.sortKey || "createdAt";
    const sortDir = req.query.sortDir === "asc" ? 1 : -1;

    const totalCount = await OccasionMaster.countDocuments(query);
    const data = await OccasionMaster.find(query)
      .populate("group_id", "name icon")
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

// 2. Get Active Occasions (For Enquiry Form Category Chips)
export const getActiveOccasions = async (req, res) => {
  try {
    const data = await OccasionMaster.find({ is_active: true })
      .populate("group_id", "name icon")
      .sort({ name: 1 })
      .lean();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 3. Get Occasion by ID
export const getOccasionById = async (req, res) => {
  try {
    const item = await OccasionMaster.findById(req.params.id)
      .populate("group_id", "name icon")
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .lean();
    if (!item) {
      return res.status(404).json({ success: false, message: "Occasion not found" });
    }
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 4. Create Occasion
export const createOccasion = async (req, res) => {
  try {
    const { group_id, name, icon, is_active } = req.body;

    if (!group_id) {
      return res.status(400).json({ success: false, message: "Occasion group is required" });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Occasion name is required" });
    }

    const existing = await OccasionMaster.findOne({
      group_id,
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: "Occasion already exists in this group" });
    }

    const item = new OccasionMaster({
      group_id,
      name: name.trim(),
      icon: icon || "🎯",
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user?._id,
    });

    await item.save();
    const populated = await item.populate("group_id", "name icon");
    res.status(201).json({ success: true, message: "Occasion created successfully", data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 5. Update Occasion
export const updateOccasion = async (req, res) => {
  try {
    const { id } = req.params;
    const { group_id, name, icon, is_active } = req.body;

    if (name && group_id) {
      const existing = await OccasionMaster.findOne({
        group_id,
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(400).json({ success: false, message: "Occasion already exists in this group" });
      }
    }

    const updatePayload = {
      ...(group_id !== undefined && { group_id }),
      ...(name && { name: name.trim() }),
      ...(icon !== undefined && { icon }),
      ...(is_active !== undefined && { is_active }),
      updated_by: req.user?._id,
    };

    const updated = await OccasionMaster.findByIdAndUpdate(id, updatePayload, { new: true })
      .populate("group_id", "name icon");
    if (!updated) {
      return res.status(404).json({ success: false, message: "Occasion not found" });
    }

    res.status(200).json({ success: true, message: "Occasion updated successfully", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 6. Delete Occasion
export const deleteOccasion = async (req, res) => {
  try {
    const deleted = await OccasionMaster.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Occasion not found" });
    }
    res.status(200).json({ success: true, message: "Occasion deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const occasionMasterController = {
  getAll: getAllOccasions,
  getActive: getActiveOccasions,
  getById: getOccasionById,
  create: createOccasion,
  update: updateOccasion,
  deleteItem: deleteOccasion,
};

export default occasionMasterController;
