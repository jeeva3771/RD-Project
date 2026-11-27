import ProductConfigMaster from "../../../models/masters/enquiryFlow/productConfigMasterModel.js";

// Ensure standard products are seeded if collection is empty
export const ensureProductsSeeded = async () => {
  try {
    const count = await ProductConfigMaster.countDocuments({});
    if (count === 0) {
      const { PRODUCTS } = await import("../../../scripts/seedProductConfigs.js");
      for (const prodItem of PRODUCTS) {
        await ProductConfigMaster.findOneAndUpdate(
          { product_id: prodItem.product_id },
          { $set: prodItem },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }
  } catch (err) {
    console.error("Error auto-seeding products:", err);
  }
};

// Reset/Sync all products to standard seed templates
export const resetToDefaults = async (req, res) => {
  try {
    let seedModule;
    try {
      seedModule = await import("../../../scripts/seedProductConfigs.js");
    } catch {
      return res.status(400).json({
        success: false,
        message: "Seed configuration file not found. Database already contains current configurations.",
      });
    }
    const { PRODUCTS } = seedModule;
    for (const prodItem of PRODUCTS) {
      await ProductConfigMaster.findOneAndUpdate(
        { product_id: prodItem.product_id },
        { $set: prodItem },
        { upsert: true, new: true }
      );
    }
    const data = await ProductConfigMaster.find({ is_active: true })
      .sort({ sort_order: 1, createdAt: 1 })
      .lean();

    res.status(200).json({
      success: true,
      message: "Standard product templates reset and synced successfully",
      data,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// 1. Get All Product Configs (Paginated, Search & Sort)
export const getAll = async (req, res) => {
  try {
    await ensureProductsSeeded();

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { product_id: { $regex: search, $options: "i" } },
        { sub_label: { $regex: search, $options: "i" } },
      ];
    }
    if (typeof req.query.is_active !== "undefined" && req.query.is_active !== "") {
      query.is_active = req.query.is_active === "true" || req.query.is_active === true;
    }

    const sortKey = req.query.sortKey || "sort_order";
    const sortDir = req.query.sortDir === "desc" ? -1 : 1;

    const totalCount = await ProductConfigMaster.countDocuments(query);
    const data = await ProductConfigMaster.find(query)
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

// 2. Get Active Products (For Enquiry Flow Dynamic Engine)
export const getActive = async (req, res) => {
  try {
    const data = await ProductConfigMaster.find({ is_active: true })
      .sort({ sort_order: 1, createdAt: 1 })
      .lean();

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 3. Get Single Product by product_id (e.g. 'scroll', 'keychain')
export const getByProductId = async (req, res) => {
  try {
    const { productId } = req.params;
    const data = await ProductConfigMaster.findOne({
      product_id: productId.toLowerCase(),
      is_active: true,
    }).lean();

    if (!data) {
      return res.status(404).json({ success: false, message: "Product configuration not found" });
    }

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 4. Get By ID
export const getById = async (req, res) => {
  try {
    const data = await ProductConfigMaster.findById(req.params.id)
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .lean();

    if (!data) {
      return res.status(404).json({ success: false, message: "Product configuration not found" });
    }

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 5. Create Product Config
export const create = async (req, res) => {
  try {
    const { product_id, name } = req.body;
    if (!product_id || !name) {
      return res.status(400).json({
        success: false,
        message: "Product ID and Product Name are required",
      });
    }

    const cleanId = String(product_id).toLowerCase().trim();
    const existing = await ProductConfigMaster.findOne({ product_id: cleanId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Product with ID '${cleanId}' already exists`,
      });
    }

    const newDoc = new ProductConfigMaster({
      ...req.body,
      product_id: cleanId,
      created_by: req.user?._id || null,
      updated_by: req.user?._id || null,
    });

    await newDoc.save();
    res.status(201).json({
      success: true,
      message: "Product configuration created successfully",
      data: newDoc,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 6. Update Product Config
export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updated_by: req.user?._id || null };

    if (updateData.product_id) {
      updateData.product_id = String(updateData.product_id).toLowerCase().trim();
      const existing = await ProductConfigMaster.findOne({
        product_id: updateData.product_id,
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Product ID '${updateData.product_id}' is already in use by another product`,
        });
      }
    }

    const updated = await ProductConfigMaster.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: "Product configuration not found" });
    }

    res.status(200).json({
      success: true,
      message: "Product configuration updated successfully",
      data: updated,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 7. Delete Product Config
export const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ProductConfigMaster.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Product configuration not found" });
    }

    res.status(200).json({
      success: true,
      message: "Product configuration deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  getAll,
  getActive,
  getByProductId,
  getById,
  create,
  update,
  deleteItem,
  resetToDefaults,
};

