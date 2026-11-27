import OccasionGroupMaster from "../../../models/masters/enquiryFlow/occasionGroupMasterModel.js";
import OccasionMaster from "../../../models/masters/enquiryFlow/occasionMasterModel.js";

// 1. Get All Occasion Groups (Paginated with Search & Filter)
export const getAllOccasionGroups = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (typeof req.query.is_active !== "undefined" && req.query.is_active !== "") {
      query.is_active = req.query.is_active === "true" || req.query.is_active === true;
    }

    const sortKey = req.query.sortKey || "sort_order";
    const sortDir = req.query.sortDir === "desc" ? -1 : 1;

    const totalCount = await OccasionGroupMaster.countDocuments(query);
    const data = await OccasionGroupMaster.find(query)
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
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 2. Get Active Occasion Groups (For dropdowns and selection)
export const getActiveOccasionGroups = async (req, res) => {
  try {
    const data = await OccasionGroupMaster.find({ is_active: true })
      .sort({ sort_order: 1, name: 1 })
      .lean();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 3. Get Occasion Group by ID
export const getOccasionGroupById = async (req, res) => {
  try {
    const item = await OccasionGroupMaster.findById(req.params.id)
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .lean();
    if (!item) {
      return res.status(404).json({ success: false, message: "Occasion group not found" });
    }
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 4. Create Occasion Group
export const createOccasionGroup = async (req, res) => {
  try {
    const { name, icon, description, sort_order, is_active } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Group name is required" });
    }

    const existing = await OccasionGroupMaster.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: "An occasion group with this name already exists" });
    }

    const item = new OccasionGroupMaster({
      name: name.trim(),
      icon: icon || "📁",
      description: description ? description.trim() : "",
      sort_order: typeof sort_order === "number" ? sort_order : 0,
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user?._id,
    });

    await item.save();
    res.status(201).json({ success: true, message: "Occasion group created successfully", data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 5. Update Occasion Group
export const updateOccasionGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, description, sort_order, is_active } = req.body;

    const current = await OccasionGroupMaster.findById(id);
    if (!current) {
      return res.status(404).json({ success: false, message: "Occasion group not found" });
    }

    if (name && name.trim()) {
      const existing = await OccasionGroupMaster.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(400).json({ success: false, message: "An occasion group with this name already exists" });
      }
    }

    const oldName = current.name;
    const newName = name ? name.trim() : oldName;

    const updatePayload = {
      ...(name && { name: newName }),
      ...(icon !== undefined && { icon }),
      ...(description !== undefined && { description: description.trim() }),
      ...(sort_order !== undefined && { sort_order: Number(sort_order) || 0 }),
      ...(is_active !== undefined && { is_active }),
      updated_by: req.user?._id,
    };

    const updated = await OccasionGroupMaster.findByIdAndUpdate(id, updatePayload, { new: true });
    res.status(200).json({ success: true, message: "Occasion group updated successfully", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 6. Delete Occasion Group
export const deleteOccasionGroup = async (req, res) => {
  try {
    const group = await OccasionGroupMaster.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: "Occasion group not found" });
    }

    // Check if any occasions are linked to this group
    const usageCount = await OccasionMaster.countDocuments({ group_id: group._id });

    if (usageCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete group "${group.name}" because it is currently used by ${usageCount} occasion(s). Please reassign or delete those occasions first.`,
      });
    }

    await OccasionGroupMaster.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Occasion group deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const occasionGroupMasterController = {
  getAll: getAllOccasionGroups,
  getActive: getActiveOccasionGroups,
  getById: getOccasionGroupById,
  create: createOccasionGroup,
  update: updateOccasionGroup,
  deleteItem: deleteOccasionGroup,
};

export default occasionGroupMasterController;
