import TrophyMaterial from "../../../models/masters/enquiryFlow/trophyMaterialModel.js";

export const DEFAULT_MATERIALS = [
  { name: "MDF", base_rate: 65, unit: "inch" },
  { name: "Wood", base_rate: 80, unit: "inch" },
  { name: "MS", base_rate: 85, unit: "inch" },
  { name: "Acrylic", base_rate: 95, unit: "inch" },
  { name: "Aluminium", base_rate: 105, unit: "inch" },
  { name: "Resin", base_rate: 110, unit: "inch" },
  { name: "Metal", base_rate: 120, unit: "inch" },
  { name: "3D printing", base_rate: 140, unit: "inch" },
  { name: "Glass", base_rate: 150, unit: "inch" },
  { name: "Brass", base_rate: 165, unit: "inch" },
  { name: "Crystal", base_rate: 290, unit: "inch" },
];

// 1. Get All Trophy Materials (Paginated with Search & Filter, with Auto-Seed)
export const getAllTrophyMaterials = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";

    // Auto-seed if empty and no search
    if (!search && (await TrophyMaterial.countDocuments()) === 0) {
      for (const mat of DEFAULT_MATERIALS) {
        await TrophyMaterial.findOneAndUpdate(
          { name: mat.name },
          { $setOnInsert: { ...mat, is_active: true } },
          { upsert: true, new: true }
        );
      }
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

    const totalCount = await TrophyMaterial.countDocuments(query);
    const data = await TrophyMaterial.find(query)
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

// 2. Get Active Trophy Materials (For Enquiry Costing / Dropdown)
export const getActiveTrophyMaterials = async (req, res) => {
  try {
    if ((await TrophyMaterial.countDocuments()) === 0) {
      for (const mat of DEFAULT_MATERIALS) {
        await TrophyMaterial.findOneAndUpdate(
          { name: mat.name },
          { $setOnInsert: { ...mat, is_active: true } },
          { upsert: true, new: true }
        );
      }
    }
    const data = await TrophyMaterial.find({ is_active: true }).sort({ name: 1 }).lean();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 3. Get Trophy Material by ID
export const getTrophyMaterialById = async (req, res) => {
  try {
    const item = await TrophyMaterial.findById(req.params.id)
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .lean();
    if (!item) {
      return res.status(404).json({ success: false, message: "Material not found" });
    }
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 4. Create Trophy Material
export const createTrophyMaterial = async (req, res) => {
  try {
    const { name, base_rate, unit, description, is_active } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Material name is required" });
    }

    const existing = await TrophyMaterial.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: "Material with this name already exists" });
    }

    const item = new TrophyMaterial({
      name: name.trim(),
      base_rate: Number(base_rate) || 0,
      unit: unit ? unit.trim() : "inch",
      description: description || "",
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user?._id,
    });

    await item.save();
    res.status(201).json({ success: true, message: "Material created successfully", data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 5. Update Trophy Material
export const updateTrophyMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, base_rate, unit, description, is_active } = req.body;

    if (name) {
      const existing = await TrophyMaterial.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(400).json({ success: false, message: "Material with this name already exists" });
      }
    }

    const updatePayload = {
      ...(name && { name: name.trim() }),
      ...(base_rate !== undefined && { base_rate: Number(base_rate) }),
      ...(unit !== undefined && { unit: unit.trim() }),
      ...(description !== undefined && { description }),
      ...(is_active !== undefined && { is_active }),
      updated_by: req.user?._id,
    };

    const updated = await TrophyMaterial.findByIdAndUpdate(id, updatePayload, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Material not found" });
    }

    res.status(200).json({ success: true, message: "Material updated successfully", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 6. Delete Trophy Material
export const deleteTrophyMaterial = async (req, res) => {
  try {
    const deleted = await TrophyMaterial.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Material not found" });
    }
    res.status(200).json({ success: true, message: "Material deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 7. Seed Default Materials
export const seedDefaultMaterials = async (req, res) => {
  try {
    let seededCount = 0;
    for (const mat of DEFAULT_MATERIALS) {
      const existing = await TrophyMaterial.findOne({ name: mat.name });
      if (!existing) {
        await TrophyMaterial.create({
          ...mat,
          created_by: req.user?._id,
        });
        seededCount++;
      }
    }
    res.status(200).json({
      success: true,
      message: `Default materials verified. ${seededCount} new materials added.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const trophyMaterialController = {
  getAll: getAllTrophyMaterials,
  getActive: getActiveTrophyMaterials,
  getById: getTrophyMaterialById,
  create: createTrophyMaterial,
  update: updateTrophyMaterial,
  deleteItem: deleteTrophyMaterial,
  seedDefault: seedDefaultMaterials,
};

export default trophyMaterialController;
