import DeliveryScopeMaster from "../../../models/masters/enquiryFlow/deliveryScopeMasterModel.js";

// 1. Get All Delivery Scopes (Paginated with Search & Filter)
export const getAllDeliveryScopes = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";

    const query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { subtitle: { $regex: search, $options: "i" } },
        { scope_key: { $regex: search, $options: "i" } },
      ];
    }

    if (typeof req.query.is_active !== "undefined" && req.query.is_active !== "") {
      query.is_active = req.query.is_active === "true" || req.query.is_active === true;
    }

    const sortKey = req.query.sortKey || "createdAt";
    const sortDir = req.query.sortDir === "asc" ? 1 : -1;

    const totalCount = await DeliveryScopeMaster.countDocuments(query);
    const data = await DeliveryScopeMaster.find(query)
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

// 2. Get Active Delivery Scopes (For Enquiry Form Cards)
export const getActiveDeliveryScopes = async (req, res) => {
  try {
    const data = await DeliveryScopeMaster.find({ is_active: true }).sort({ transit_days: 1 }).lean();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 3. Get Delivery Scope by ID
export const getDeliveryScopeById = async (req, res) => {
  try {
    const item = await DeliveryScopeMaster.findById(req.params.id)
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .lean();
    if (!item) {
      return res.status(404).json({ success: false, message: "Delivery scope not found" });
    }
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 4. Create Delivery Scope
export const createDeliveryScope = async (req, res) => {
  try {
    const { scope_key, title, subtitle, icon, transit_days, carriers, is_active } = req.body;
    if (!scope_key || !scope_key.trim()) {
      return res.status(400).json({ success: false, message: "Scope key is required (e.g. local, state, domestic)" });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Scope title is required" });
    }

    const existing = await DeliveryScopeMaster.findOne({
      scope_key: { $regex: new RegExp(`^${scope_key.trim()}$`, "i") },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: "Delivery scope with this key already exists" });
    }

    const item = new DeliveryScopeMaster({
      scope_key: scope_key.trim().toLowerCase(),
      title: title.trim(),
      subtitle: subtitle || "",
      icon: icon || "🏙️",
      transit_days: Number(transit_days) || 0,
      carriers: Array.isArray(carriers) ? carriers : typeof carriers === "string" ? carriers.split(",").map(c => c.trim()) : [],
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user?._id,
    });

    await item.save();
    res.status(201).json({ success: true, message: "Delivery scope created successfully", data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 5. Update Delivery Scope
export const updateDeliveryScope = async (req, res) => {
  try {
    const { id } = req.params;
    const { scope_key, title, subtitle, icon, transit_days, carriers, is_active } = req.body;

    if (scope_key) {
      const existing = await DeliveryScopeMaster.findOne({
        scope_key: { $regex: new RegExp(`^${scope_key.trim()}$`, "i") },
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(400).json({ success: false, message: "Delivery scope with this key already exists" });
      }
    }

    const updatePayload = {
      ...(scope_key && { scope_key: scope_key.trim().toLowerCase() }),
      ...(title && { title: title.trim() }),
      ...(subtitle !== undefined && { subtitle }),
      ...(icon !== undefined && { icon }),
      ...(transit_days !== undefined && { transit_days: Number(transit_days) }),
      ...(carriers !== undefined && {
        carriers: Array.isArray(carriers) ? carriers : typeof carriers === "string" ? carriers.split(",").map(c => c.trim()) : [],
      }),
      ...(is_active !== undefined && { is_active }),
      updated_by: req.user?._id,
    };

    const updated = await DeliveryScopeMaster.findByIdAndUpdate(id, updatePayload, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Delivery scope not found" });
    }

    res.status(200).json({ success: true, message: "Delivery scope updated successfully", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 6. Delete Delivery Scope
export const deleteDeliveryScope = async (req, res) => {
  try {
    const deleted = await DeliveryScopeMaster.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Delivery scope not found" });
    }
    res.status(200).json({ success: true, message: "Delivery scope deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deliveryScopeMasterController = {
  getAll: getAllDeliveryScopes,
  getActive: getActiveDeliveryScopes,
  getById: getDeliveryScopeById,
  create: createDeliveryScope,
  update: updateDeliveryScope,
  deleteItem: deleteDeliveryScope,
};

export default deliveryScopeMasterController;
