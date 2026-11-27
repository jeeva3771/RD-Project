import ConstructionMaster from "../../../models/masters/enquiryFlow/constructionMasterModel.js";

export const DEFAULT_CONSTRUCTIONS = [
  { name: "13x11 CNC", icon: "🔲" },
  { name: "CNC with a solid base", icon: "🧱" },
  { name: "Plaque with a stud", icon: "📍" },
  { name: "Composite, solid base", icon: "🏛️" },
  { name: "Composite, single step", icon: "🪜" },
  { name: "Composite, double step", icon: "🪜" },
  { name: "Self-standing block", icon: "🧊" },
  { name: "Fibre frame", icon: "🖼️" },
  { name: "Medal", icon: "🥇" },
  { name: "Clear acrylic, hollow LED base", icon: "💡" },
  { name: "3D figurine, solid base", icon: "🗿" },
  { name: "Shadow box (3D object)", icon: "🗃️" },
];

const ensureConstructionsSeeded = async () => {
  if ((await ConstructionMaster.countDocuments()) === 0) {
    for (const item of DEFAULT_CONSTRUCTIONS) {
      await ConstructionMaster.findOneAndUpdate(
        { name: item.name },
        { $setOnInsert: { ...item, is_active: true } },
        { upsert: true, new: true }
      );
    }
  }
};

// 1. Get All Constructions (Paginated with Search & Filter)
export const getAllConstructions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";

    // Auto-seed if empty
    if (!search) {
      await ensureConstructionsSeeded();
    }

    const query = {};
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (typeof req.query.is_active !== "undefined" && req.query.is_active !== "") {
      query.is_active = req.query.is_active === "true" || req.query.is_active === true;
    }

    const sortKey = req.query.sortKey || "createdAt";
    const sortDir = req.query.sortDir === "asc" ? 1 : -1;

    const totalCount = await ConstructionMaster.countDocuments(query);
    const data = await ConstructionMaster.find(query)
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

// 2. Get Active Constructions (For Enquiry Form Dropdown)
export const getActiveConstructions = async (req, res) => {
  try {
    await ensureConstructionsSeeded();
    const data = await ConstructionMaster.find({ is_active: true }).sort({ createdAt: 1, name: 1 }).lean();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 3. Get Construction by ID
export const getConstructionById = async (req, res) => {
  try {
    const item = await ConstructionMaster.findById(req.params.id)
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .lean();
    if (!item) {
      return res.status(404).json({ success: false, message: "Construction not found" });
    }
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 4. Create Construction
export const createConstruction = async (req, res) => {
  try {
    const { name, icon, is_active } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Construction name is required" });
    }

    const existing = await ConstructionMaster.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: "Construction with this name already exists" });
    }

    const item = new ConstructionMaster({
      name: name.trim(),
      icon: icon || "🔲",
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user?._id,
    });

    await item.save();
    res.status(201).json({ success: true, message: "Construction created successfully", data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 5. Update Construction
export const updateConstruction = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, is_active } = req.body;

    if (name) {
      const existing = await ConstructionMaster.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(400).json({ success: false, message: "Construction with this name already exists" });
      }
    }

    const updatePayload = {
      ...(name && { name: name.trim() }),
      ...(icon !== undefined && { icon }),
      ...(is_active !== undefined && { is_active }),
      updated_by: req.user?._id,
    };

    const updated = await ConstructionMaster.findByIdAndUpdate(id, updatePayload, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Construction not found" });
    }

    res.status(200).json({ success: true, message: "Construction updated successfully", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 6. Delete Construction
export const deleteConstruction = async (req, res) => {
  try {
    const deleted = await ConstructionMaster.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Construction not found" });
    }
    res.status(200).json({ success: true, message: "Construction deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const constructionMasterController = {
  getAll: getAllConstructions,
  getActive: getActiveConstructions,
  getById: getConstructionById,
  create: createConstruction,
  update: updateConstruction,
  deleteItem: deleteConstruction,
};

export default constructionMasterController;
