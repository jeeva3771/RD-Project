import TrophyTypeMaster from "../../../models/masters/enquiryFlow/trophyTypeMasterModel.js";

export const DEFAULT_TROPHY_TYPES = [
  // Classic
  { category: "Classic", name: "Trophy", label: "Trophy", icon: "🏆" },
  { category: "Classic", name: "Cup", label: "Cup", icon: "🏆" },
  { category: "Classic", name: "Plaque", label: "Plaque", icon: "🏆" },
  { category: "Classic", name: "Memento", label: "Memento", icon: "🏆" },
  { category: "Classic", name: "Medal", label: "Medal", icon: "🏆" },
  { category: "Classic", name: "Shield", label: "Shield", icon: "🏆" },
  { category: "Classic", name: "Corporate gift", label: "Corporate gift", icon: "🏆" },

  // Themed trophies
  { category: "Themed trophies", name: "Location theme trophy", label: "Location theme trophy", icon: "🎨" },
  { category: "Themed trophies", name: "Logo themed trophy", label: "Logo themed trophy", icon: "🎨" },
  { category: "Themed trophies", name: "Product replica trophy", label: "Product replica trophy", icon: "🎨" },
  { category: "Themed trophies", name: "Milestone number trophy", label: "Milestone number trophy", icon: "🎨" },
  { category: "Themed trophies", name: "Brand mascot trophy", label: "Brand mascot trophy", icon: "🎨" },
  { category: "Themed trophies", name: "Photo frame trophy", label: "Photo frame trophy", icon: "🎨" },

  // Sports · outdoor
  { category: "Sports · outdoor", name: "Cricket", label: "Cricket", icon: "🏏" },
  { category: "Sports · outdoor", name: "Football", label: "Football", icon: "⚽" },
  { category: "Sports · outdoor", name: "Hockey", label: "Hockey", icon: "🏑" },
  { category: "Sports · outdoor", name: "Kabaddi", label: "Kabaddi", icon: "🤼" },
  { category: "Sports · outdoor", name: "Kho-kho", label: "Kho-kho", icon: "🏃" },
  { category: "Sports · outdoor", name: "Athletics & marathon", label: "Athletics & marathon", icon: "🥇" },
  { category: "Sports · outdoor", name: "Tennis", label: "Tennis", icon: "🎾" },
  { category: "Sports · outdoor", name: "Golf", label: "Golf", icon: "⛳" },
  { category: "Sports · outdoor", name: "Volleyball", label: "Volleyball", icon: "🏐" },

  // Sports · indoor
  { category: "Sports · indoor", name: "Badminton", label: "Badminton", icon: "🏸" },
  { category: "Sports · indoor", name: "Table tennis", label: "Table tennis", icon: "🏓" },
  { category: "Sports · indoor", name: "Chess", label: "Chess", icon: "♟️" },
  { category: "Sports · indoor", name: "Carrom", label: "Carrom", icon: "🎯" },
  { category: "Sports · indoor", name: "Squash", label: "Squash", icon: "🎾" },
  { category: "Sports · indoor", name: "Billiards & pool", label: "Billiards & pool", icon: "🎱" },
  { category: "Sports · indoor", name: "Basketball", label: "Basketball", icon: "🏀" },
  { category: "Sports · indoor", name: "Swimming", label: "Swimming", icon: "🏊" },
  { category: "Sports · indoor", name: "Shooting", label: "Shooting", icon: "🎯" },
];

const ensureTrophyTypesSeeded = async () => {
  if ((await TrophyTypeMaster.countDocuments()) === 0) {
    for (const item of DEFAULT_TROPHY_TYPES) {
      await TrophyTypeMaster.findOneAndUpdate(
        { category: item.category, name: item.name },
        { $setOnInsert: { ...item, is_active: true } },
        { upsert: true, new: true }
      );
    }
  }
};

// 1. Get All Trophy Types (Paginated with Search & Filter)
export const getAllTrophyTypes = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";

    if (!search) {
      await ensureTrophyTypesSeeded();
    }

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { label: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    if (typeof req.query.is_active !== "undefined" && req.query.is_active !== "") {
      query.is_active = req.query.is_active === "true" || req.query.is_active === true;
    }

    const sortKey = req.query.sortKey || "createdAt";
    const sortDir = req.query.sortDir === "asc" ? 1 : -1;

    const totalCount = await TrophyTypeMaster.countDocuments(query);
    const data = await TrophyTypeMaster.find(query)
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

// 2. Get Active Trophy Types (For Enquiry Form Category & Options)
export const getActiveTrophyTypes = async (req, res) => {
  try {
    await ensureTrophyTypesSeeded();
    const data = await TrophyTypeMaster.find({ is_active: true }).sort({ category: 1, createdAt: 1, name: 1 }).lean();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 3. Get Trophy Type by ID
export const getTrophyTypeById = async (req, res) => {
  try {
    const item = await TrophyTypeMaster.findById(req.params.id)
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .lean();
    if (!item) {
      return res.status(404).json({ success: false, message: "Trophy type not found" });
    }
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 4. Create Trophy Type
export const createTrophyType = async (req, res) => {
  try {
    const { category, name, label, icon, is_active } = req.body;
    if (!category || !category.trim()) {
      return res.status(400).json({ success: false, message: "Category is required" });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Type name is required" });
    }

    const existing = await TrophyTypeMaster.findOne({
      category: category.trim(),
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: "Trophy type already exists in this category" });
    }

    const item = new TrophyTypeMaster({
      category: category.trim(),
      name: name.trim(),
      label: label ? label.trim() : name.trim(),
      icon: icon || "🏆",
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user?._id,
    });

    await item.save();
    res.status(201).json({ success: true, message: "Trophy type created successfully", data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 5. Update Trophy Type
export const updateTrophyType = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, name, label, icon, is_active } = req.body;

    if (name && category) {
      const existing = await TrophyTypeMaster.findOne({
        category: category.trim(),
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(400).json({ success: false, message: "Trophy type already exists in this category" });
      }
    }

    const updatePayload = {
      ...(category && { category: category.trim() }),
      ...(name && { name: name.trim() }),
      ...(label !== undefined && { label: label.trim() }),
      ...(icon !== undefined && { icon }),
      ...(is_active !== undefined && { is_active }),
      updated_by: req.user?._id,
    };

    const updated = await TrophyTypeMaster.findByIdAndUpdate(id, updatePayload, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Trophy type not found" });
    }

    res.status(200).json({ success: true, message: "Trophy type updated successfully", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 6. Delete Trophy Type
export const deleteTrophyType = async (req, res) => {
  try {
    const deleted = await TrophyTypeMaster.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Trophy type not found" });
    }
    res.status(200).json({ success: true, message: "Trophy type deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const trophyTypeMasterController = {
  getAll: getAllTrophyTypes,
  getActive: getActiveTrophyTypes,
  getById: getTrophyTypeById,
  create: createTrophyType,
  update: updateTrophyType,
  deleteItem: deleteTrophyType,
};

export default trophyTypeMasterController;
