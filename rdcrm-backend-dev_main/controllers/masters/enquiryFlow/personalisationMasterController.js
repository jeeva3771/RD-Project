import PersonalisationMaster from "../../../models/masters/enquiryFlow/personalisationMasterModel.js";

// 1. Get All Personalisation Options (Paginated with Search & Filter)
export const getAllPersonalisationOptions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";

    const query = {};
    if (search) {
      query.label = { $regex: search, $options: "i" };
    }

    if (typeof req.query.is_active !== "undefined" && req.query.is_active !== "") {
      query.is_active = req.query.is_active === "true" || req.query.is_active === true;
    }

    const sortKey = req.query.sortKey || "createdAt";
    const sortDir = req.query.sortDir === "asc" ? 1 : -1;

    const totalCount = await PersonalisationMaster.countDocuments(query);
    const data = await PersonalisationMaster.find(query)
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

// 2. Get Active Personalisation Options (For Enquiry Form Pill Selection)
export const getActivePersonalisationOptions = async (req, res) => {
  try {
    const data = await PersonalisationMaster.find({ is_active: true }).sort({ extra_cost: 1 }).lean();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 3. Get Personalisation Option by ID
export const getPersonalisationOptionById = async (req, res) => {
  try {
    const item = await PersonalisationMaster.findById(req.params.id)
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .lean();
    if (!item) {
      return res.status(404).json({ success: false, message: "Personalisation option not found" });
    }
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 4. Create Personalisation Option
export const createPersonalisationOption = async (req, res) => {
  try {
    const { label, extra_cost, is_active } = req.body;
    if (!label || !label.trim()) {
      return res.status(400).json({ success: false, message: "Label is required" });
    }

    const existing = await PersonalisationMaster.findOne({
      label: { $regex: new RegExp(`^${label.trim()}$`, "i") },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: "Personalisation option with this label already exists" });
    }

    const item = new PersonalisationMaster({
      label: label.trim(),
      extra_cost: Number(extra_cost) || 0,
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user?._id,
    });

    await item.save();
    res.status(201).json({ success: true, message: "Personalisation option created successfully", data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 5. Update Personalisation Option
export const updatePersonalisationOption = async (req, res) => {
  try {
    const { id } = req.params;
    const { label, extra_cost, is_active } = req.body;

    if (label && label.trim()) {
      const existing = await PersonalisationMaster.findOne({
        label: { $regex: new RegExp(`^${label.trim()}$`, "i") },
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(400).json({ success: false, message: "Personalisation option with this label already exists" });
      }
    }

    const updatePayload = {
      ...(label && { label: label.trim() }),
      ...(extra_cost !== undefined && { extra_cost: Number(extra_cost) }),
      ...(is_active !== undefined && { is_active }),
      updated_by: req.user?._id,
    };

    const updated = await PersonalisationMaster.findByIdAndUpdate(id, updatePayload, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Personalisation option not found" });
    }

    res.status(200).json({ success: true, message: "Personalisation option updated successfully", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 6. Delete Personalisation Option
export const deletePersonalisationOption = async (req, res) => {
  try {
    const deleted = await PersonalisationMaster.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Personalisation option not found" });
    }
    res.status(200).json({ success: true, message: "Personalisation option deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const personalisationMasterController = {
  getAll: getAllPersonalisationOptions,
  getActive: getActivePersonalisationOptions,
  getById: getPersonalisationOptionById,
  create: createPersonalisationOption,
  update: updatePersonalisationOption,
  deleteItem: deletePersonalisationOption,
};

export default personalisationMasterController;
