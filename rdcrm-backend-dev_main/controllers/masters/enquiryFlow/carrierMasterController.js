import CarrierMaster from "../../../models/masters/enquiryFlow/carrierMasterModel.js";

// Standard Carrier Master values derived directly from helpers.js & PackDelivery.jsx constants
export const STANDARD_CARRIERS = [
  { name: "Our vehicle", icon: "🚐", has_charges: false, applies_to: "both", is_active: true },
  { name: "Hand delivery", icon: "🤝", has_charges: false, applies_to: "both", is_active: true },
  { name: "Tempo", icon: "🛻", has_charges: true, applies_to: "both", is_active: true },
  { name: "Porter", icon: "🛵", has_charges: true, applies_to: "both", is_active: true },
  { name: "Courier", icon: "📮", has_charges: true, applies_to: "both", is_active: true },
  { name: "Air cargo", icon: "✈️", has_charges: true, applies_to: "both", is_active: true },
  { name: "Client's courier", icon: "📦", has_charges: false, applies_to: "both", is_active: true },
  { name: "Client pickup", icon: "🏢", has_charges: false, applies_to: "both", is_active: true },
  { name: "Photo / video only", icon: "📷", has_charges: false, applies_to: "sample", is_active: true },
];

// Helper function to ensure initial standard carriers exist without deleting user data
export const ensureStandardCarriers = async () => {
  try {
    const count = await CarrierMaster.countDocuments({});
    if (count === 0) {
      for (const carrier of STANDARD_CARRIERS) {
        await CarrierMaster.findOneAndUpdate(
          { name: { $regex: new RegExp(`^${carrier.name.trim()}$`, "i") } },
          {
            $setOnInsert: {
              name: carrier.name,
              icon: carrier.icon,
              has_charges: carrier.has_charges,
              applies_to: carrier.applies_to,
              is_active: carrier.is_active,
            },
          },
          { upsert: true, new: true }
        );
      }
    }
  } catch (err) {
    console.error("Error in ensureStandardCarriers:", err);
  }
};

// 1. Get All Carriers (Paginated with filters)
export const getAll = async (req, res) => {
  try {
    await ensureStandardCarriers();

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";
    const applies_to = req.query.applies_to?.trim();

    const query = {};
    if (applies_to) {
      query.applies_to = applies_to;
    }
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    if (typeof req.query.is_active !== "undefined" && req.query.is_active !== "") {
      query.is_active = req.query.is_active === "true" || req.query.is_active === true;
    }

    const sortKey = req.query.sortKey || "createdAt";
    const sortDir = req.query.sortDir === "asc" ? 1 : -1;

    const totalCount = await CarrierMaster.countDocuments(query);
    const data = await CarrierMaster.find(query)
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

// 2. Get Active Carriers (for dropdowns / selection chips)
export const getActive = async (req, res) => {
  try {
    await ensureStandardCarriers();
    const { applies_to } = req.query;
    const query = {
      is_active: { $ne: false }
    };

    if (applies_to) {
      query.$or = [
        { applies_to: { $in: [applies_to, "both"] } },
        { applies_to: { $exists: false } },
        { applies_to: null },
      ];
    }

    const data = await CarrierMaster.find(query)
      .sort({ name: 1 })
      .lean();

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 3. Get By ID
export const getById = async (req, res) => {
  try {
    const item = await CarrierMaster.findById(req.params.id)
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .lean();
    if (!item) {
      return res.status(404).json({ success: false, message: "Carrier not found" });
    }
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 4. Create Carrier
export const create = async (req, res) => {
  try {
    const { name, icon, has_charges, applies_to, is_active } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Carrier name is required" });
    }

    const existing = await CarrierMaster.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Carrier "${name.trim()}" already exists`,
      });
    }

    const item = new CarrierMaster({
      name: name.trim(),
      icon: icon?.trim() || "🚚",
      has_charges: has_charges === true || has_charges === "true",
      applies_to: applies_to || "both",
      is_active: typeof is_active !== "undefined" ? is_active : true,
      created_by: req.user?._id || req.user?.id || null,
      updated_by: req.user?._id || req.user?.id || null,
    });

    await item.save();
    res.status(201).json({ success: true, data: item, message: "Carrier created successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 5. Update Carrier
export const update = async (req, res) => {
  try {
    const { name, icon, has_charges, applies_to, is_active } = req.body;
    const existing = await CarrierMaster.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Carrier not found" });
    }

    if (name && name.trim()) {
      const duplicate = await CarrierMaster.findOne({
        _id: { $ne: req.params.id },
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Carrier "${name.trim()}" already exists`,
        });
      }
      existing.name = name.trim();
    }

    if (typeof icon !== "undefined") existing.icon = icon.trim() || "🚚";
    if (typeof has_charges !== "undefined") {
      existing.has_charges = has_charges === true || has_charges === "true";
    }
    if (applies_to) existing.applies_to = applies_to;
    if (typeof is_active !== "undefined") {
      existing.is_active = is_active === true || is_active === "true";
    }

    existing.updated_by = req.user?._id || req.user?.id || null;
    await existing.save();

    res.status(200).json({ success: true, data: existing, message: "Carrier updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 6. Delete Carrier
export const deleteItem = async (req, res) => {
  try {
    const item = await CarrierMaster.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Carrier not found" });
    }
    res.status(200).json({ success: true, message: "Carrier deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 7. Reset Carriers to Standard Constants (Cleans all unwanted data and populates standard 8)
export const resetToStandard = async (req, res) => {
  try {
    // Delete all records from carrier_masters
    await CarrierMaster.deleteMany({});

    const docs = STANDARD_CARRIERS.map((c) => ({
      ...c,
      created_by: req.user?._id || req.user?.id || null,
      updated_by: req.user?._id || req.user?.id || null,
    }));

    const inserted = await CarrierMaster.insertMany(docs);
    res.status(200).json({
      success: true,
      message: `Reset successful! Cleaned old data and seeded ${inserted.length} standard carriers from constants.`,
      data: inserted,
    });
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
  resetToStandard,
  STANDARD_CARRIERS,
};
