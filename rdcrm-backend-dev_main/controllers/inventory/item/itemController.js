import { nanoid } from "nanoid";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import itemModel from "../../../models/inventory/item/itemModel.js";
import userModel from "../../../models/users/userModel.js";
import { getCurrentDate } from "../../../helpers/dateTime.js";
import mongoose from "mongoose";
import materialTypeModel from "../../../models/inventory/common/materialTypeModel.js";
import materialCategoryModel from "../../../models/inventory/common/materialCategoryModel.js";
import rateUnitModel from "../../../models/inventory/common/rateUnitModel.js";
import stockSizeModel from "../../../models/inventory/common/stockSizeModel.js";
import vendorModel from "../../../models/masters/vendorModel.js";
import blockedMaterialModel from "../../../models/inventory/blocked_materials/blockedMaterialModel.js";
import { recordStockMovement } from "../stockLedgerController.js";

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
    const pageVal = parseInt(req.query.page);
    const limitVal = parseInt(req.query.limit);

    const page = isNaN(pageVal) ? 1 : Math.max(1, pageVal);
    const hasLimit = !isNaN(limitVal);
    const limit = hasLimit ? Math.min(1000, Math.max(1, limitVal)) : null;
    const skip = hasLimit ? (page - 1) * limit : 0;

    const search = req.query.search?.trim() || "";
    const category = req.query.category || "";

    // Sorting
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const typeId = req.query.type_id || "";

    const type_id_name = req.query.type_id_name || "";





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
        localField: "unit",
        foreignField: "_id",
        as: "unit",
      },
    });
    pipeline.push({ $unwind: { path: "$unit", preserveNullAndEmptyArrays: true } });

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

    // ADD PROFIT RATE
    pipeline.push({
      $addFields: {
        profit_rate: {
          $cond: [
            { $gt: [{ $toDouble: "$cost" }, 0] },
            {
              $multiply: [
                {
                  $divide: [
                    {
                      $subtract: [
                        { $toDouble: "$price" },
                        { $toDouble: "$cost" },
                      ],
                    },
                    { $toDouble: "$cost" },
                  ],
                },
                100,
              ],
            },
            0,
          ],
        },
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
      case "rate_units":
        sortStage = { "unit.name": sortOrder };
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
      $project: {
        stock: 1,
        min_stock: 1,
        computedStockValue: {
          $cond: [
            { $eq: ["$item_type", "sheet"] },
            // If it is a sheet
            {
              $cond: [
                { $and: [{ $isArray: "$size_wise_stock" }, { $gt: [{ $size: "$size_wise_stock" }, 0] }] },
                // If size_wise_stock has entries, sum up count * width * height * cost
                {
                  $reduce: {
                    input: "$size_wise_stock",
                    initialValue: 0,
                    in: {
                      $add: [
                        "$$value",
                        {
                          $let: {
                            vars: {
                              matchedSize: {
                                $arrayElemAt: [
                                  {
                                    $filter: {
                                      input: "$stock_sizes",
                                      as: "sz",
                                      cond: { $eq: ["$$sz._id", "$$this.size_id"] }
                                    }
                                  },
                                  0
                                ]
                              }
                            },
                            in: {
                              $multiply: [
                                { $ifNull: ["$$this.count", 0] },
                                { $ifNull: ["$$matchedSize.width", 0] },
                                { $ifNull: ["$$matchedSize.height", 0] },
                                { $convert: { input: "$cost", to: "double", onError: 0, onNull: 0 } }
                              ]
                            }
                          }
                        }
                      ]
                    }
                  }
                },
                // Fallback: If size_wise_stock is empty but stock_sizes is populated, use the first size
                {
                  $cond: [
                    { $and: [{ $isArray: "$stock_sizes" }, { $gt: [{ $size: "$stock_sizes" }, 0] }] },
                    {
                      $let: {
                        vars: {
                          firstSize: { $arrayElemAt: ["$stock_sizes", 0] }
                        },
                        in: {
                          $multiply: [
                            { $ifNull: ["$stock", 0] },
                            { $ifNull: ["$$firstSize.width", 0] },
                            { $ifNull: ["$$firstSize.height", 0] },
                            { $convert: { input: "$cost", to: "double", onError: 0, onNull: 0 } }
                          ]
                        }
                      }
                    },
                    // Absolute fallback: stock * cost
                    {
                      $multiply: [
                        { $ifNull: ["$stock", 0] },
                        { $convert: { input: "$cost", to: "double", onError: 0, onNull: 0 } }
                      ]
                    }
                  ]
                }
              ]
            },
            // If it is not a sheet, standard formula stock * cost
            {
              $multiply: [
                { $ifNull: ["$stock", 0] },
                { $convert: { input: "$cost", to: "double", onError: 0, onNull: 0 } }
              ]
            }
          ]
        }
      }
    });
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
        totalStockValue: { $sum: "$computedStockValue" }
      }
    });

    const countResult = await itemModel.aggregate(countPipeline);
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
    const materials = await itemModel.aggregate(pipeline);

    res.json({
      success: true,
      page,
      limit: limit || "All Items",
      total: totalCount,
      totalPages: limit ? Math.ceil(totalCount / limit) : 1,
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
      unit,
      price,
      cost,
      stock,
      min_stock,
      max_stock,
      stock_sizes,
      size_wise_stock,
      supplier_ids,
      is_active,
      logical_rate,
    } = req.body;

    if (!name || !type_id || !item_type || !unit) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    const exists = await itemModel.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
    });
    if (exists)
      return res.status(409).json({
        success: false,
        message: "Item already exists",
      });

    const lastItem = await itemModel
      .findOne({ item_code: { $regex: /^ITM\d+$/ } })
      .sort({ createdAt: -1 });

    const nextNo =
      lastItem?.item_code
        ? parseInt(lastItem.item_code.replace("ITM", "")) + 1
        : 1;

    const newItem = new itemModel({
      id: nanoid(16),
      item_code: `ITM${String(nextNo).padStart(3, "0")}`,
      name: name.trim(),
      type_id,
      item_type,
      unit,
      price: price || 0,
      cost: cost || 0,
      stock: Number(stock) || 0,
      min_stock: Number(min_stock) || 0,
      max_stock: Number(max_stock) || 0,
      stock_sizes: Array.isArray(stock_sizes) ? stock_sizes : [],
      size_wise_stock: Array.isArray(size_wise_stock) ? size_wise_stock : [],
      supplier_ids: Array.isArray(supplier_ids) ? supplier_ids : [],
      logical_rate: Array.isArray(logical_rate) ? logical_rate : [],
      is_active: is_active !== undefined ? is_active : true,
      created_by: userId,
      created_at: getCurrentDate(),
    });

    if (category_id) {
      newItem.category_id = category_id;
    }

    const saved = await newItem.save();

    if (saved.stock > 0) {
      await recordStockMovement({
        item_id: saved._id,
        item_code: saved.item_code,
        item_name: saved.name,
        unit: "pcs",
        type: "OPENING",
        ref_type: "INITIAL_SEED",
        ref_id: `NEW-ITEM-${Date.now().toString().slice(-6)}`,
        qty_in: saved.stock,
        qty_out: 0,
        cost_per_unit: Number(saved.cost) || 0,
        location: "G-1",
        remarks: `Initial stock for new item creation`,
        created_by: userId
      });
    }

    res.status(201).json({
      success: true,
      message: "Item created successfully",
      data: saved,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// UPDATE MATERIAL
export const updateMaterial = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    const item = await itemModel.findOne({ id });
    if (!item)
      return res.status(404).json({ success: false, message: "Item not found" });

    const updateData = { ...req.body }

    const oldStock = Number(item.stock) || 0;
    const newStock = updateData.stock !== undefined ? Number(updateData.stock) : oldStock;
    const stockDiff = newStock - oldStock;

    if (updateData.category_id === "") {
      delete updateData.category_id;
    }

    Object.assign(item, {
      ...updateData,
      updated_by: userId,
      updated_at: getCurrentDate(),
    });

    const updated = await item.save();

    if (stockDiff !== 0) {
      // Need to try to get unit name safely if populated or not
      let unitName = "pcs";
      if (item.unit && item.unit.name) {
        unitName = item.unit.name;
      }
      
      await recordStockMovement({
        item_id: item._id,
        item_code: item.item_code,
        item_name: item.name,
        unit: unitName,
        type: "ADJUSTMENT",
        ref_type: "MANUAL_ADJUSTMENT",
        ref_id: `MASTER-UPDATE-${Date.now().toString().slice(-6)}`,
        qty_in: stockDiff > 0 ? stockDiff : 0,
        qty_out: stockDiff < 0 ? Math.abs(stockDiff) : 0,
        cost_per_unit: Number(item.cost) || 0,
        location: item.location || "G-1",
        remarks: `Manual stock update via Item Master edit`,
        created_by: userId
      });
    }

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

    const deleted = await itemModel.findOneAndDelete({ id });
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
      {
        $lookup: {
          from: "stock_sizes",
          localField: "stock_sizes",
          foreignField: "_id",
          as: "stock_sizes",
        },
      },
      { $project: { _id: 1, id: 1, item_type: 1, stock_sizes: 1, size_wise_stock: 1, stock: 1, name: 1, category_id: 1, type_id: 1 } }
    ];

    const standardMaterials = await itemModel.aggregate(pipeline);

    // Combine both standard and custom materials
    const materials = standardMaterials;

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

// BULK UPLOAD MATERIALS
export const bulkUploadMaterials = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: User ID not found" });
    }

    const userExists = await userModel.exists({ _id: userId, is_active: true });
    if (!userExists) {
      return res.status(403).json({ success: false, message: "User not valid or inactive" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const datasheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(datasheet, { defval: "" });

    if (!data || data.length === 0) {
      return res.status(400).json({ success: false, message: "Uploaded Excel file is empty" });
    }

    // Pre-fetch masters for fast lookup
    const [types, categories, rateUnits, stockSizes, vendors] = await Promise.all([
      materialTypeModel.find({}).lean(),
      materialCategoryModel.find({}).lean(),
      rateUnitModel.find({}).lean(),
      stockSizeModel.find({}).lean(),
      vendorModel.find({}).lean(),
    ]);

    const typeMap = new Map();
    types.forEach((t) => {
      const norm = t.name.toLowerCase().trim();
      typeMap.set(norm, t);
      if (norm.endsWith("s")) {
        typeMap.set(norm.slice(0, -1), t);
      } else {
        typeMap.set(norm + "s", t);
      }
      if (norm === "consumable" || norm === "consumables") {
        typeMap.set("consumable", t);
        typeMap.set("consumables", t);
      }
      if (norm === "raw material" || norm === "raw materials") {
        typeMap.set("raw material", t);
        typeMap.set("raw materials", t);
      }
      if (norm === "packing material" || norm === "packing materials") {
        typeMap.set("packing material", t);
        typeMap.set("packing materials", t);
      }
    });

    const categoryMap = new Map();
    categories.forEach((c) => {
      const norm = c.name.toLowerCase().trim();
      categoryMap.set(norm, c);
      if (norm.endsWith("s")) {
        categoryMap.set(norm.slice(0, -1), c);
      } else {
        categoryMap.set(norm + "s", c);
      }
    });

    const unitMap = new Map();
    rateUnits.forEach((u) => {
      const normName = u.name.toLowerCase().trim();
      const normSymbol = (u.symbol || "").toLowerCase().trim();

      // Exact name & symbol
      unitMap.set(normName, u);
      if (normSymbol) unitMap.set(normSymbol, u);

      // Name without "per " prefix (e.g. "per square inch" -> "square inch", "per piece" -> "piece", "per unit" -> "unit")
      const strippedPer = normName.replace(/^per\s+/i, "").trim();
      unitMap.set(strippedPer, u);

      // Common aliases & plural forms
      if (normSymbol === "sqin" || strippedPer.includes("square inch") || normName.includes("square inch")) {
        [
          "square inch",
          "square inches",
          "sq inch",
          "sq inches",
          "sqin",
          "sq in",
          "sq.in.",
          "sq. in.",
          "sq. in",
          "sqinch",
          "per sq in",
          "per sqin",
          "per square inch",
          "per square inches"
        ].forEach((alias) => unitMap.set(alias, u));
      }
      if (normSymbol === "pc" || strippedPer.includes("piece") || normName.includes("piece")) {
        [
          "piece",
          "pieces",
          "pc",
          "pcs",
          "pc.",
          "pcs.",
          "per pc",
          "per pcs",
          "per piece",
          "per pieces"
        ].forEach((alias) => unitMap.set(alias, u));
      }
      if (normSymbol === "unit" || strippedPer.includes("unit") || normName.includes("unit")) {
        [
          "unit",
          "units",
          "per unit",
          "per units"
        ].forEach((alias) => unitMap.set(alias, u));
      }
      if (normSymbol === "sheet" || strippedPer.includes("sheet") || normName.includes("sheet")) {
        [
          "sheet",
          "sheets",
          "per sheet",
          "per sheets"
        ].forEach((alias) => unitMap.set(alias, u));
      }
      if (normSymbol === "min" || strippedPer.includes("minute") || normName.includes("minute")) {
        [
          "minute",
          "minutes",
          "min",
          "mins",
          "per min",
          "per minute",
          "per minutes"
        ].forEach((alias) => unitMap.set(alias, u));
      }
      if (normSymbol === "pkg" || strippedPer.includes("kilogram") || strippedPer.includes("kg") || normName.includes("kilogram")) {
        [
          "kilogram",
          "kilograms",
          "kg",
          "kgs",
          "pkg",
          "per kg",
          "per kilogram",
          "per kilograms"
        ].forEach((alias) => unitMap.set(alias, u));
      }
    });

    const sizeMap = new Map();
    stockSizes.forEach((s) => {
      sizeMap.set(s.size.toLowerCase().replace(/\s+/g, ""), s);
    });

    const vendorMap = new Map();
    vendors.forEach((v) => vendorMap.set(v.name.toLowerCase().trim(), v));

    // Get the current max item sequence number
    const lastItem = await itemModel
      .findOne({ item_code: { $regex: /^ITM\d+$/ } })
      .sort({ createdAt: -1 });

    let nextNo = lastItem?.item_code
      ? parseInt(lastItem.item_code.replace("ITM", ""), 10) + 1
      : 1;

    // Track names in this batch to prevent duplicates inside the same file
    const batchNames = new Set();

    const results = {
      total: data.length,
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const [index, row] of data.entries()) {
      const rowNum = index + 2; // Excel row numbering (header is row 1)
      const name = (row["Item Name"] || row["Material Name"] || row["name"] || row["Item"] || "").toString().trim();
      const typeName = (row["Type"] || row["Material Type"] || row["type"] || "").toString().trim();
      const categoryName = (row["Category"] || row["Material Category"] || row["category"] || "").toString().trim();
      const itemTypeRaw = (row["Item Type"] || row["item_type"] || "").toString().trim().toLowerCase();
      const unitName = (row["Rate Unit"] || row["Unit"] || row["unit"] || "").toString().trim();
      const priceRaw = (row["Price"] || row["Selling Price"] || row["Price (₹)"] || row["price"] || "0").toString().trim();
      const costRaw = (row["Cost"] || row["Cost Price"] || row["Cost (₹)"] || row["cost"] || "0").toString().trim();
      const stockSizesRaw = (row["Stock Sizes"] || row["Stock Size"] || row["stock_sizes"] || row["sheet_sizes"] || "").toString().trim();
      const stockRaw = (row["Stock"] || row["Current Stock"] || row["Initial Stock"] || row["stock"] || "0").toString().trim();
      const minStockRaw = (row["Min Stock"] || row["Minimum Stock"] || row["min_stock"] || "0").toString().trim();
      const maxStockRaw = (row["Max Stock"] || row["Maximum Stock"] || row["max_stock"] || "0").toString().trim();
      const vendorsRaw = (row["Vendors"] || row["Suppliers"] || row["Vendor"] || row["vendors"] || "").toString().trim();
      const logicRatesRaw = (row["Logic Rates"] || row["Logical Rates"] || row["logical_rate"] || row["Logic Rules"] || "").toString().trim();

      try {
        // Validation: Required Fields
        if (!name) throw new Error("Item Name is required");
        if (!typeName) throw new Error("Material Type is required");
        if (!itemTypeRaw) throw new Error("Item Type is required");
        if (!unitName) throw new Error("Rate Unit is required");

        // Validate Item Type Enum
        const validItemTypes = ["sheet", "direct", "unit", "capacity", "logic"];
        if (!validItemTypes.includes(itemTypeRaw)) {
          throw new Error(`Invalid Item Type '${itemTypeRaw}'. Must be one of: ${validItemTypes.join(", ")}`);
        }

        // Check Type
        const matchedType = typeMap.get(typeName.toLowerCase());
        if (!matchedType) {
          throw new Error(`Material Type '${typeName}' not found in master list`);
        }

        // Check Category (Mandatory if Type is "Raw Material")
        let categoryId = undefined;
        const isRawMaterial = matchedType.name.toLowerCase() === "raw material";
        if (isRawMaterial && !categoryName) {
          throw new Error("Category is required for Raw Material");
        }
        if (categoryName) {
          const matchedCat = categoryMap.get(categoryName.toLowerCase());
          if (!matchedCat) {
            throw new Error(`Category '${categoryName}' not found in master list`);
          }
          categoryId = matchedCat._id;
        }

        // Check Rate Unit
        const matchedUnit = unitMap.get(unitName.toLowerCase());
        if (!matchedUnit) {
          throw new Error(`Rate Unit '${unitName}' not found in master list`);
        }

        // Validate Duplicate Names
        const lowerName = name.toLowerCase();
        if (batchNames.has(lowerName)) {
          throw new Error(`Duplicate Item Name '${name}' in the same file`);
        }
        batchNames.add(lowerName);

        const existingItem = await itemModel.findOne({
          name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: "i" },
        });
        if (existingItem) {
          throw new Error(`Item with name '${name}' already exists`);
        }

        // Parse Stock Sizes (Mandatory for sheet items)
        let resolvedStockSizes = [];
        let resolvedSizeWiseStock = [];
        let calculatedSheetStock = 0;

        if (itemTypeRaw === "sheet") {
          if (!stockSizesRaw) {
            throw new Error("Stock Sizes are required for sheet type");
          }

          const sizeEntries = stockSizesRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
          if (sizeEntries.length === 0) {
            throw new Error("At least one stock size is required for sheet type");
          }

          for (const entry of sizeEntries) {
            // Check if count is specified in brackets e.g. "24x48(10)" or "24x48[10]"
            const matchCount = entry.match(/^([^(|[]+)(?:[([](\d+)[)\]])?$/);
            const sizeStr = matchCount ? matchCount[1].trim() : entry;
            const count = matchCount && matchCount[2] ? parseInt(matchCount[2], 10) : 0;

            const normalizedSizeKey = sizeStr.toLowerCase().replace(/\s+/g, "");
            const matchedSizeDoc = sizeMap.get(normalizedSizeKey);

            if (!matchedSizeDoc) {
              throw new Error(`Stock size '${sizeStr}' not found in master list`);
            }

            if (!resolvedStockSizes.includes(matchedSizeDoc._id)) {
              resolvedStockSizes.push(matchedSizeDoc._id);
              const sqinch = (matchedSizeDoc.width || 0) * (matchedSizeDoc.height || 0) * count;
              resolvedSizeWiseStock.push({
                size_id: matchedSizeDoc._id,
                count: count,
                sqinch: sqinch,
              });
              calculatedSheetStock += sqinch;
            }
          }
        }

        // Parse Vendors
        let resolvedVendorIds = [];
        if (vendorsRaw) {
          const vendorNames = vendorsRaw.split(/[,;]/).map((v) => v.trim()).filter(Boolean);
          for (const vName of vendorNames) {
            const matchedVendor = vendorMap.get(vName.toLowerCase());
            if (matchedVendor && !resolvedVendorIds.includes(matchedVendor._id)) {
              resolvedVendorIds.push(matchedVendor._id);
            }
          }
        }

        // Parse Logic Rates
        let resolvedLogicalRates = [];
        if (itemTypeRaw === "logic" && logicRatesRaw) {
          const ruleStrings = logicRatesRaw.split(/[,;]/).map((r) => r.trim()).filter(Boolean);
          for (const rStr of ruleStrings) {
            // Match e.g. "jobQty >= 1000: 20" or "logic1 >= 500: 40" or ">= 100: 50"
            const ruleMatch = rStr.match(/^(?:(logic1|logic2|logic3|jobQty|job\s*qty)\s*)?(>=|<=|>|<|==|=)\s*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/i);
            if (ruleMatch) {
              let rawField = ruleMatch[1] ? ruleMatch[1].trim() : "";
              let field = "logic1";
              if (/^job\s*qty$/i.test(rawField) || rawField.toLowerCase() === "jobqty") {
                field = "jobQty";
              } else if (/^logic\s*1$/i.test(rawField) || rawField.toLowerCase() === "logic1") {
                field = "logic1";
              } else if (/^logic\s*2$/i.test(rawField) || rawField.toLowerCase() === "logic2") {
                field = "logic2";
              } else if (/^logic\s*3$/i.test(rawField) || rawField.toLowerCase() === "logic3") {
                field = "logic3";
              } else if (!rawField) {
                if (name.toLowerCase().includes("black box")) field = "logic3";
                else if (name.toLowerCase().includes("thermocol")) field = "jobQty";
                else field = "logic1";
              }

              let operator = ruleMatch[2] === "=" ? "==" : ruleMatch[2];
              const value = parseFloat(ruleMatch[3]);
              const rate = ruleMatch[4];

              resolvedLogicalRates.push({
                condition: { field, operator, value },
                rate: rate.toString(),
              });
            }
          }
        }

        // Number sanitation
        const price = isNaN(parseFloat(priceRaw)) ? "0" : parseFloat(priceRaw).toFixed(2);
        const cost = isNaN(parseFloat(costRaw)) ? "0" : parseFloat(costRaw).toFixed(2);
        const stock = itemTypeRaw === "sheet" && calculatedSheetStock > 0
          ? calculatedSheetStock
          : Math.max(0, parseInt(stockRaw, 10) || 0);
        const min_stock = Math.max(0, parseInt(minStockRaw, 10) || 0);
        const max_stock = Math.max(0, parseInt(maxStockRaw, 10) || 0);

        const itemCode = `ITM${String(nextNo).padStart(3, "0")}`;
        nextNo++;

        const newItem = new itemModel({
          id: nanoid(16),
          item_code: itemCode,
          name: name,
          type_id: matchedType._id,
          category_id: categoryId,
          item_type: itemTypeRaw,
          unit: matchedUnit._id,
          price,
          cost,
          stock,
          min_stock,
          max_stock,
          stock_sizes: resolvedStockSizes,
          size_wise_stock: resolvedSizeWiseStock,
          supplier_ids: resolvedVendorIds,
          logical_rate: resolvedLogicalRates,
          is_active: true,
          created_by: userId,
          created_at: getCurrentDate(),
        });

        await newItem.save();
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          row: rowNum,
          item_name: name || "N/A",
          message: err.message,
        });
      }
    }

    let mainMessage = "";
    if (results.failed > 0 && results.success === 0) {
      mainMessage = `Bulk upload failed: All ${results.failed} rows had errors.`;
    } else if (results.failed > 0) {
      mainMessage = `Bulk upload partially completed: ${results.success} items created, ${results.failed} failed.`;
    } else {
      mainMessage = `Bulk upload completed successfully: ${results.success} items created.`;
    }

    res.status(results.failed > 0 && results.success === 0 ? 400 : 200).json({
      success: results.success > 0,
      message: mainMessage,
      data: results,
    });
  } catch (error) {
    console.error("Bulk upload items error:", error);
    res.status(500).json({ success: false, message: "Internal server error during bulk upload" });
  }
};

// DOWNLOAD SAMPLE TEMPLATE (With Native In-Cell Excel Dropdowns)
export const downloadItemSampleTemplate = async (req, res) => {
  try {
    const [types, categories, rateUnits, stockSizes, vendors] = await Promise.all([
      materialTypeModel.find({ is_active: true }).lean(),
      materialCategoryModel.find({ is_active: true }).lean(),
      rateUnitModel.find({ is_active: true }).lean(),
      stockSizeModel.find({ is_active: true }).lean(),
      vendorModel.find({ is_active: true }).lean(),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "RDCA CRM";
    workbook.created = new Date();

    // Sheet 1: Items
    const itemsSheet = workbook.addWorksheet("Items", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    itemsSheet.columns = [
      { header: "Item Name", key: "name", width: 34 },
      { header: "Material Type", key: "type", width: 22 },
      { header: "Category", key: "category", width: 20 },
      { header: "Item Type", key: "item_type", width: 16 },
      { header: "Rate Unit", key: "unit", width: 24 },
      { header: "Price (₹)", key: "price", width: 14 },
      { header: "Cost (₹)", key: "cost", width: 14 },
      { header: "Stock Sizes", key: "stock_sizes", width: 26 },
      { header: "Stock", key: "stock", width: 12 },
      { header: "Min Stock", key: "min_stock", width: 12 },
      { header: "Max Stock", key: "max_stock", width: 12 },
      { header: "Vendors", key: "vendors", width: 26 },
      { header: "Logic Rates", key: "logic_rates", width: 45 },
    ];

    // Header styling
    itemsSheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF3B82F6" }, // Modern Blue
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    itemsSheet.getRow(1).height = 28;

    // Add realistic sample rows
    const sampleRows = [
      {
        name: "3 MM Clear Acrylic Sheet",
        type: "Raw Material",
        category: "Acrylic",
        item_type: "sheet",
        unit: "Per Square Inch",
        price: 1.25,
        cost: 0.95,
        stock_sizes: "24x48(10), 48x96(5)",
        stock: "",
        min_stock: 5000,
        max_stock: 50000,
        vendors: vendors.length > 0 ? vendors[0].name : "",
        logic_rates: "",
      },
      {
        name: "Standard Kraft Box (Custom)",
        type: "Packing Material",
        category: "",
        item_type: "unit",
        unit: "Per Piece",
        price: 45.00,
        cost: 32.00,
        stock_sizes: "",
        stock: 200,
        min_stock: 50,
        max_stock: 500,
        vendors: vendors.length > 1 ? vendors[1].name : "",
        logic_rates: "",
      },
      {
        name: "Black Box (Custom)",
        type: "Packing Material",
        category: "",
        item_type: "logic",
        unit: "Per Piece",
        price: 50.00,
        cost: 35.00,
        stock_sizes: "",
        stock: 0,
        min_stock: 0,
        max_stock: 0,
        vendors: "",
        logic_rates: "logic3 >= 200: 25, logic3 >= 100: 35, logic3 < 100: 50",
      },
      {
        name: "Thermocol Slab 25mm",
        type: "Packing Material",
        category: "",
        item_type: "logic",
        unit: "Per Piece",
        price: 40.00,
        cost: 28.00,
        stock_sizes: "",
        stock: 0,
        min_stock: 0,
        max_stock: 0,
        vendors: "",
        logic_rates: "jobQty >= 1000: 20, jobQty >= 500: 30, jobQty >= 100: 40",
      },
      {
        name: "Double Sided Adhesive Tape 1 Inch",
        type: "Consumable",
        category: "",
        item_type: "direct",
        unit: "Per Unit",
        price: 150.00,
        cost: 110.00,
        stock_sizes: "",
        stock: 25,
        min_stock: 5,
        max_stock: 50,
        vendors: "",
        logic_rates: "",
      },
    ];

    sampleRows.forEach((row) => itemsSheet.addRow(row));

    // Sheet 2: Reference Guide
    const guideSheet = workbook.addWorksheet("Reference Guide");
    guideSheet.columns = [
      { header: "Material Types", key: "types", width: 24 },
      { header: "Categories", key: "categories", width: 24 },
      { header: "Item Types", key: "item_types", width: 18 },
      { header: "Rate Units", key: "rate_units", width: 26 },
      { header: "Stock Sizes", key: "stock_sizes", width: 18 },
    ];

    guideSheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F46E5" }, // Indigo
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    guideSheet.getRow(1).height = 26;

    const typeNames = types.map((t) => t.name);
    const categoryNames = categories.map((c) => c.name);
    const itemTypeEnum = ["sheet", "direct", "unit", "capacity", "logic"];
    const rateUnitNames = rateUnits.map((u) => u.name);
    const stockSizeNames = stockSizes.map((s) => s.size);

    const maxRows = Math.max(
      typeNames.length,
      categoryNames.length,
      itemTypeEnum.length,
      rateUnitNames.length,
      stockSizeNames.length,
      1
    );

    for (let i = 0; i < maxRows; i++) {
      guideSheet.addRow({
        types: typeNames[i] || "",
        categories: categoryNames[i] || "",
        item_types: itemTypeEnum[i] || "",
        rate_units: rateUnitNames[i] || "",
        stock_sizes: stockSizeNames[i] || "",
      });
    }

    // Apply In-Cell Dropdown Data Validations to rows 2 to 500
    const typeFormula = `'Reference Guide'!$A$2:$A$${Math.max(typeNames.length + 1, 2)}`;
    const catFormula = `'Reference Guide'!$B$2:$B$${Math.max(categoryNames.length + 1, 2)}`;
    const itemTypeFormula = `'Reference Guide'!$C$2:$C$${itemTypeEnum.length + 1}`;
    const unitFormula = `'Reference Guide'!$D$2:$D$${Math.max(rateUnitNames.length + 1, 2)}`;

    for (let r = 2; r <= 500; r++) {
      // Material Type (Col B)
      itemsSheet.getCell(`B${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [typeFormula],
        showErrorMessage: true,
        errorTitle: "Invalid Material Type",
        error: "Please choose a valid Material Type from the dropdown.",
      };

      // Category (Col C)
      itemsSheet.getCell(`C${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [catFormula],
        showErrorMessage: true,
        errorTitle: "Invalid Category",
        error: "Please choose a valid Category from the dropdown.",
      };

      // Item Type (Col D)
      itemsSheet.getCell(`D${r}`).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: [itemTypeFormula],
        showErrorMessage: true,
        errorTitle: "Invalid Item Type",
        error: "Please choose from: sheet, direct, unit, capacity, logic.",
      };

      // Rate Unit (Col E)
      itemsSheet.getCell(`E${r}`).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: [unitFormula],
        showErrorMessage: true,
        errorTitle: "Invalid Rate Unit",
        error: "Please choose a valid Rate Unit from the dropdown.",
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader("Content-Disposition", 'attachment; filename="Inventory_Item_Bulk_Upload_Template.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buffer);
  } catch (error) {
    console.error("Download template error:", error);
    res.status(500).json({ success: false, message: "Error generating sample template" });
  }
};



