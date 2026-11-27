import ElementMaster from "../../../models/masters/enquiryFlow/elementMasterModel.js";

export const DEFAULT_ELEMENTS = [
  { name: "Metal elements", icon: "⚙️", extra_cost: 0 },
  { name: "Metal laser-cut elements", icon: "✂️", extra_cost: 0 },
  { name: "Metal casting elements", icon: "🔥", extra_cost: 0 },
  { name: "Gold / silver plated", icon: "✨", extra_cost: 0 },
  { name: "Lanyard", icon: "🎗️", extra_cost: 0 },
];

// 1. Get All Elements (Paginated with Search & Filter, with Auto-Seed)
export const getAllElements = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";

    // Auto-seed if empty and no search
    if (!search && (await ElementMaster.countDocuments()) === 0) {
      for (const el of DEFAULT_ELEMENTS) {
        await ElementMaster.findOneAndUpdate(
          { name: el.name },
          { $setOnInsert: { ...el, is_active: true } },
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

    const totalCount = await ElementMaster.countDocuments(query);
    const data = await ElementMaster.find(query)
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

// 2. Get Active Elements (For Enquiry Form Dropdown)
export const getActiveElements = async (req, res) => {
  try {
    if ((await ElementMaster.countDocuments()) === 0) {
      for (const el of DEFAULT_ELEMENTS) {
        await ElementMaster.findOneAndUpdate(
          { name: el.name },
          { $setOnInsert: { ...el, is_active: true } },
          { upsert: true, new: true }
        );
      }
    }
    const data = await ElementMaster.find({ is_active: true }).sort({ name: 1 }).lean();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 3. Get Element by ID
export const getElementById = async (req, res) => {
  try {
    const item = await ElementMaster.findById(req.params.id)
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .lean();
    if (!item) {
      return res.status(404).json({ success: false, message: "Element not found" });
    }
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 4. Create Element
export const createElement = async (req, res) => {
  try {
    const { name, icon, extra_cost, is_active } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Element name is required" });
    }

    const existing = await ElementMaster.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: "Element with this name already exists" });
    }

    const item = new ElementMaster({
      name: name.trim(),
      icon: icon || "⚙️",
      extra_cost: Number(extra_cost) || 0,
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user?._id,
    });

    await item.save();
    res.status(201).json({ success: true, message: "Element created successfully", data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 5. Update Element
export const updateElement = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, extra_cost, is_active } = req.body;

    if (name) {
      const existing = await ElementMaster.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(400).json({ success: false, message: "Element with this name already exists" });
      }
    }

    const updatePayload = {
      ...(name && { name: name.trim() }),
      ...(icon !== undefined && { icon }),
      ...(extra_cost !== undefined && { extra_cost: Number(extra_cost) }),
      ...(is_active !== undefined && { is_active }),
      updated_by: req.user?._id,
    };

    const updated = await ElementMaster.findByIdAndUpdate(id, updatePayload, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Element not found" });
    }

    res.status(200).json({ success: true, message: "Element updated successfully", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 6. Delete Element
export const deleteElement = async (req, res) => {
  try {
    const deleted = await ElementMaster.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Element not found" });
    }
    res.status(200).json({ success: true, message: "Element deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 7. Seed Default Elements
export const seedDefaultElements = async (req, res) => {
  try {
    let seededCount = 0;
    for (const el of DEFAULT_ELEMENTS) {
      const existing = await ElementMaster.findOne({ name: el.name });
      if (!existing) {
        await ElementMaster.create({
          ...el,
          created_by: req.user?._id,
        });
        seededCount++;
      }
    }
    res.status(200).json({
      success: true,
      message: `Default elements verified. ${seededCount} new elements added.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const elementMasterController = {
  getAll: getAllElements,
  getActive: getActiveElements,
  getById: getElementById,
  create: createElement,
  update: updateElement,
  deleteItem: deleteElement,
  seedDefault: seedDefaultElements,
};

export default elementMasterController;
