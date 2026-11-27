import { nanoid } from "nanoid";
import customItemModel from "../../../models/inventory/customItem/customItemModel.js";
import userModel from "../../../models/users/userModel.js";
import { getCurrentDate } from "../../../helpers/dateTime.js";
import mongoose from "mongoose";
import materialTypeModel from "../../../models/inventory/common/materialTypeModel.js";
import blockedMaterialModel from "../../../models/inventory/blocked_materials/blockedMaterialModel.js";

// GET ALL MATERIALS
export const getAllMaterials = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });

    const userExists = await userModel.exists({ _id: userId, is_active: true });
    if (!userExists)
      return res.status(403).json({
        success: false,
        message: "User not valid or inactive",
      });

    // Pagination
    const page = Math.max(1, parseInt(req.query.page));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit)));
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";
    const category = req.query.category || "";

    // Sorting
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const typeId = req.query.type_id || "";

    const type_id_name = req.query.type_id_name || "";
    const is_inventory_item = req.query.is_inventory_item;





    // AGGREGATION PIPELINE
    const pipeline = [];

    const matchQuery = {};
    if (search) {
      matchQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { item_code: { $regex: search, $options: "i" } },
        { specifications: { $regex: search, $options: "i" } },
      ];
    }

    if (category)
      matchQuery.category_id = new mongoose.Types.ObjectId(category);

    if (type_id_name) {
      const typeDoc = await materialTypeModel.findOne({ name: "Packing Material" });
      console.log("typeDoc", typeDoc)
      if (typeDoc) {
        matchQuery.type_id = new mongoose.Types.ObjectId(typeDoc._id);
      }
    }


    if (typeId) matchQuery.type_id = new mongoose.Types.ObjectId(typeId);

    if (is_inventory_item !== undefined) {
      if (is_inventory_item === "false") {
        matchQuery.is_inventory_item = false;
      } else {
        // For "true", match both explicit true AND documents where the field is missing
        matchQuery.is_inventory_item = { $ne: false };
      }
    }


    console.log("Final Match Query:", JSON.stringify(matchQuery, null, 2));
    pipeline.push({ $match: matchQuery });

    // TYPE POPULATE
    pipeline.push({
      $lookup: {
        from: "material_types",
        localField: "type_id",
        foreignField: "_id",
        as: "type",
      },
    });
    pipeline.push({
      $addFields: {
        type_id: { $arrayElemAt: ["$type", 0] },
      },
    });
    pipeline.push({
      $unwind: { path: "$type", preserveNullAndEmptyArrays: true },
    });

    // CATEGORY POPULATE
    pipeline.push({
      $lookup: {
        from: "material_categories",
        localField: "category_id",
        foreignField: "_id",
        as: "category",
      },
    });
    pipeline.push({
      $unwind: { path: "$category", preserveNullAndEmptyArrays: true },
    });

    // // UNIT POPULATE
    // pipeline.push({
    //   $lookup: {
    //     from: "units",
    //     localField: "unit_id",
    //     foreignField: "_id",
    //     as: "unit",
    //   },
    // });
    // pipeline.push({
    //   $unwind: { path: "$unit", preserveNullAndEmptyArrays: true },
    // });

    pipeline.push({
      $lookup: {
        from: "rate_units",
        localField: "rate_unit",
        foreignField: "_id",
        as: "rate_unit",
      },
    });
    pipeline.push({ $unwind: { path: "$rate_unit", preserveNullAndEmptyArrays: true } });

    pipeline.push({
      $lookup: {
        from: "stock_sizes",
        localField: "stock_sizes",
        foreignField: "_id",
        as: "stock_sizes",
      },
    })
    // VENDOR POPULATE (supplier_ids array)
    pipeline.push({
      $lookup: {
        from: "vendors",
        localField: "supplier_ids",
        foreignField: "_id",
        as: "suppliers",
      },
    });

    // Extract only supplier names
    pipeline.push({
      $addFields: {
        supplier_names: {
          $map: {
            input: "$suppliers",
            as: "s",
            in: "$$s.name",
          },
        },
      },
    });

    // CREATED BY POPULATE
    pipeline.push({
      $lookup: {
        from: "users",
        localField: "created_by",
        foreignField: "_id",
        as: "createdBy",
      },
    });
    pipeline.push({
      $unwind: {
        path: "$createdBy",
        preserveNullAndEmptyArrays: true,
      },
    });

    // UPDATED BY POPULATE
    pipeline.push({
      $lookup: {
        from: "users",
        localField: "updated_by",
        foreignField: "_id",
        as: "updatedBy",
      },
    });
    pipeline.push({
      $unwind: {
        path: "$updatedBy",
        preserveNullAndEmptyArrays: true,
      },
    });


    
    // PROVENANCE LOOKUP (Fetch Job No and Ref No from Source BOM/Enquiry)
    pipeline.push({
      $lookup: {
        from: "boms",
        localField: "source_bom_id",
        foreignField: "_id",
        as: "source_bom",
      },
    });
    pipeline.push({
      $unwind: { path: "$source_bom", preserveNullAndEmptyArrays: true },
    });
    pipeline.push({
      $lookup: {
        from: "enquiries",
        localField: "source_bom.enquiry_id",
        foreignField: "_id",
        as: "source_enquiry",
      },
    });
    pipeline.push({
      $unwind: { path: "$source_enquiry", preserveNullAndEmptyArrays: true },
    });
    pipeline.push({
      $addFields: {
        job_no: { $ifNull: ["$job_no", "$source_bom.job_no"] },
        sub_job_no: { $ifNull: ["$sub_job_no", "$source_bom.sub_job_no"] },
        reference_no: { $ifNull: ["$reference_no", "$source_enquiry.reference_no"] },
      },
    });

    pipeline.push({
      $addFields: {
        sort_name: { $toLower: "$name" },
      },
    });

    // SORT CONFIGURATION
    let sortStage = {};

    switch (sortBy) {
      case "name":
        sortStage = { sort_name: sortOrder }; // ← FIXED
        break;

      case "type":
      case "type_id":
        sortStage = { "type.name": sortOrder };
        break;

      case "category":
      case "category_id":
        sortStage = { "category.name": sortOrder };
        break;

      case "unit":
      case "rate_unit":
      case "rate_units":
        sortStage = { "rate_unit.name": sortOrder };
        break;

      case "cost":
        sortStage = { "cost": sortOrder };
        break;

      case "price":
        sortStage = { "price": sortOrder };
        break;

      default:
        sortStage = { [sortBy]: sortOrder };
    }

    pipeline.push({ $sort: sortStage });

    // Count total before pagination
    const countPipeline = [...pipeline];
    countPipeline.push({
      $group: {
        _id: null,
        total: { $sum: 1 },
        totalStockUnits: { $sum: "$stock" },
        lowStockItems: {
          $sum: {
            $cond: [
              { $lte: ["$stock", { $ifNull: ["$min_stock", 0] }] },
              1,
              0
            ]
          }
        },
        totalStockValue: {
          $sum: {
            $multiply: [
              "$stock",
              { $convert: { input: "$price", to: "double", onError: 0, onNull: 0 } }
            ]
          }
        }
      }
    });

    const countResult = await customItemModel.aggregate(countPipeline);
    const totalCount = countResult[0]?.total || 0;
    const stats = {
      totalStockUnits: countResult[0]?.totalStockUnits || 0,
      lowStockItems: countResult[0]?.lowStockItems || 0,
      totalStockValue: countResult[0]?.totalStockValue || 0,
    };

    // PAGINATION
    // pipeline.push({ $skip: skip }, { $limit: limit });

    if (limit) {
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });
    }

    // Remove suppliers array from output (keep only supplier_names)
    pipeline.push({
      $project: {
        suppliers: 0,
      },
    });

    // RUN
    const materials = await customItemModel.aggregate(pipeline);

    res.json({
      success: true,
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
      sortBy,
      sortOrder: sortOrder === 1 ? "asc" : "desc",
      stats,
      data: materials,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CREATE MATERIAL
export const createMaterial = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: User ID not found" });

    const userExists = await userModel.exists({ _id: userId, is_active: true });
    if (!userExists)
      return res
        .status(403)
        .json({ success: false, message: "User not valid or inactive" });

    const {
      name,
      type_id,
      category_id,
      item_type,
      rate_unit,
      price,
      stock,
      supplier_ids,
      is_active,
      is_inventory_item,
      source_bom_id,
      source_bom_type,
      job_no,
      sub_job_no,
      reference_no,
      length,
      width,
      height,
      thickness,
      dimension_unit,
      reference_vendor_name,
    } = req.body;

    if (!name || !item_type || !rate_unit) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }



    const lastItem = await customItemModel
      .findOne({ item_code: { $regex: /^CUS\d+$/ } })
      .sort({ item_code: -1 })
      .collation({ locale: "en_US", numericOrdering: true });

    const nextNo =
      lastItem?.item_code
        ? parseInt(lastItem.item_code.replace("CUS", "")) + 1
        : 1;

    const newItemData = {
      id: nanoid(16),
      item_code: `CUS${String(nextNo).padStart(3, "0")}`,
      name: name.trim(),
      item_type,
      rate_unit,
      price: price || 0,
      height: Number(height) || undefined,
      thickness: Number(thickness) || undefined,
      dimension_unit: dimension_unit || undefined,
      reference_vendor_name: reference_vendor_name || undefined,
      stock: Number(stock) || 0,
      supplier_ids: Array.isArray(supplier_ids) ? supplier_ids : [],
      is_active: is_active !== undefined ? is_active : true,
      is_inventory_item: is_inventory_item !== undefined ? is_inventory_item : true,
      source_bom_id: source_bom_id || null,
      source_bom_type: source_bom_type || null,
      job_no: job_no || null,
      sub_job_no: sub_job_no || null,
      reference_no: reference_no || null,
      created_by: userId,
      created_at: getCurrentDate(),
    };

    if (item_type === "sheet") {
      if (length && width) {
        newItemData.sheet_size = `${length}x${width}`;
      }
    } else {
      if (length) newItemData.length = Number(length);
      if (width) newItemData.width = Number(width);
    }

    const newItem = new customItemModel(newItemData);

    if (category_id) {
      newItem.category_id = category_id;
    }
    if (type_id) {
      newItem.type_id = type_id;
    }

    const saved = await newItem.save();

    res.status(201).json({
      success: true,
      message: "Item created successfully",
      data: saved,
    });
  } catch (error) {
    console.error("CUSTOM ITEM SAVE ERROR:", error);
    if (error.code === 11000) {
      if (error.message && error.message.includes("item_code")) {
         return res.status(500).json({
           success: false,
           message: "Item code generation conflict. Please try again.",
         });
      }
      return res.status(400).json({
        success: false,
        message: "A unique constraint was violated (duplicate key).",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// UPDATE MATERIAL
export const updateMaterial = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    const item = await customItemModel.findOne({ id });
    if (!item)
      return res.status(404).json({ success: false, message: "Item not found" });

    const updateData = { ...req.body }

    if (updateData.category_id === "") {
      delete updateData.category_id;
    }

    Object.assign(item, {
      ...updateData,
      updated_by: userId,
      updated_at: getCurrentDate(),
    });

    const updated = await item.save();

    res.json({
      success: true,
      message: "Item updated successfully",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE MATERIAL
export const deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await customItemModel.findOneAndDelete({ id });
    if (!deleted)
      return res.status(404).json({ success: false, message: "Item not found" });

    res.json({
      success: true,
      message: "Item deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET MULTIPLE ITEMS STOCK
export const getItemsStockByIds = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "No IDs provided" });
    }

    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    const nanoids = ids.filter(id => !mongoose.Types.ObjectId.isValid(id));

    // Get material physical stock and sizes - match by both Mongo _id and our project nanoid 'id'
    const pipeline = [
      {
        $match: {
          $or: [
            { _id: { $in: validIds.map(id => new mongoose.Types.ObjectId(id)) } },
            { id: { $in: nanoids } }
          ]
        }
      },
      { $project: { _id: 1, id: 1, item_type: 1, stock: 1, name: 1 } }
    ];

    const materials = await customItemModel.aggregate(pipeline);

    // Get blocked counts from all sales orders
    // Use the actual Mongo _id of the materials we just found for the secondary lookup

    const blockedAggregate = await blockedMaterialModel.aggregate([
      {
        $match: {
          $or: [
            { item_id: { $in: materials.map(m => m._id) } },
          ],
          status: { $ne: "released" }
        }
      },
      {
        $group: {
          _id: {
            item_id: "$item_id",
            sheet_size: "$sheet_size"
          },
          totalBlocked: { $sum: "$quantity" }
        }
      }
    ]);

    // Attach blocked info to materials
    const materialsWithBlocked = materials.map(mat => {
      const obj = { ...mat };

      // Calculate total blocked for non-sheet items or overall for sheets
      const itemTotalBlocked = blockedAggregate
        .filter(b => b._id.item_id?.toString() === mat._id.toString())
        .reduce((sum, b) => sum + b.totalBlocked, 0);



      // Handle size-wise blocked for sheets
      if (mat.item_type === 'sheet' && Array.isArray(mat.size_wise_stock)) {
        obj.size_wise_stock = mat.size_wise_stock.map(sws => {
          const sizeDoc = mat.stock_sizes.find(ss =>
            ss._id.toString() === (sws.size_id?._id || sws.size_id).toString()
          );
          const sizeName = sizeDoc ? sizeDoc.size : "";

          const sizeBlockedCount = blockedAggregate
            .filter(b =>
              (b._id.item_id?.toString() === mat._id.toString() || (b._id.materialId && b._id.materialId === mat.id)) &&
              (b._id.sheet_size?.toString().trim().toLowerCase() === sizeName?.toString().trim().toLowerCase() ||
                (sizeName && b._id.sheet_size?.toString().trim().toLowerCase().includes(sizeName.toLowerCase())))
            )
            .reduce((sum, b) => sum + b.totalBlocked, 0);

          const blockedVal = sizeBlockedCount;
          const currentStock = sws.count || 0;
          return {
            ...sws,
            size: sizeName, // Add size name for frontend convenience
            blocked: blockedVal,
            available: currentStock - blockedVal
          };
        });
      } else {
        // For non-sheet, just calculate available
        obj.blocked_qty = itemTotalBlocked;
        obj.available_qty = (mat.stock || 0) - itemTotalBlocked;
      }

      return obj;
    });

    res.json({
      success: true,
      data: materialsWithBlocked,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

