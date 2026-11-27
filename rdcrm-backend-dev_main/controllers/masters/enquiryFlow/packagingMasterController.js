import PackagingMaster from "../../../models/masters/enquiryFlow/packagingMasterModel.js";

// 1. Get All Options (Paginated with Category Filter, Search & Sort)
export const getAll = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";
    const category = req.query.category?.trim();

    const query = {};
    if (category) {
      query.category = category;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { sub_text: { $regex: search, $options: "i" } },
      ];
    }
    if (typeof req.query.is_active !== "undefined" && req.query.is_active !== "") {
      query.is_active = req.query.is_active === "true" || req.query.is_active === true;
    }

    const sortKey = req.query.sortKey || "createdAt";
    const sortDir = req.query.sortDir === "asc" ? 1 : -1;

    const totalCount = await PackagingMaster.countDocuments(query);
    const data = await PackagingMaster.find(query)
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

// 2. Get Active Options (For Enquiry Flow Pack & Delivery Screen)
export const getActive = async (req, res) => {
  try {
    const { category } = req.query;
    const query = { is_active: true };
    if (category) {
      query.category = category;
    }

    const data = await PackagingMaster.find(query).sort({ category: 1, name: 1 }).lean();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 3. Get By ID
export const getById = async (req, res) => {
  try {
    const item = await PackagingMaster.findById(req.params.id)
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .lean();
    if (!item) {
      return res.status(404).json({ success: false, message: "Option not found" });
    }
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 4. Create Option
export const create = async (req, res) => {
  try {
    const { category, name, sub_text, icon, extra_cost, is_active } = req.body;
    if (!category) {
      return res.status(400).json({ success: false, message: "Category is required" });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Option name is required" });
    }

    const existing = await PackagingMaster.findOne({
      category,
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `An option with name "${name.trim()}" already exists in this category`,
      });
    }

    const item = new PackagingMaster({
      category,
      name: name.trim(),
      sub_text: sub_text?.trim() || "",
      icon: icon?.trim() || "📦",
      extra_cost: Number(extra_cost) || 0,
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user?._id || req.user?.id || null,
    });

    await item.save();
    res.status(201).json({ success: true, message: "Packaging option created successfully", data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 5. Update Option
export const update = async (req, res) => {
  try {
    const { category, name, sub_text, icon, extra_cost, is_active } = req.body;
    const item = await PackagingMaster.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Option not found" });
    }

    const newCategory = category || item.category;
    const newName = name ? name.trim() : item.name;

    if (name || category) {
      const existing = await PackagingMaster.findOne({
        _id: { $ne: req.params.id },
        category: newCategory,
        name: { $regex: new RegExp(`^${newName}$`, "i") },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Another option with name "${newName}" already exists in this category`,
        });
      }
    }

    item.category = newCategory;
    item.name = newName;
    if (sub_text !== undefined) item.sub_text = sub_text.trim();
    if (icon !== undefined) item.icon = icon.trim() || "📦";
    if (extra_cost !== undefined) item.extra_cost = Number(extra_cost) || 0;
    if (is_active !== undefined) item.is_active = is_active;
    item.updated_by = req.user?._id || req.user?.id || null;

    await item.save();
    res.status(200).json({ success: true, message: "Packaging option updated successfully", data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 6. Delete Option
export const deleteItem = async (req, res) => {
  try {
    const item = await PackagingMaster.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Option not found" });
    }
    res.status(200).json({ success: true, message: "Packaging option deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  getAll,
  getActive,
  getById,
  create,
  update,
  deleteItem,
};
