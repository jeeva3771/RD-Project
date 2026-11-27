import { nanoid } from "nanoid";
import stockSizeModel from "../../../models/inventory/common/stockSizeModel.js";
import userModel from "../../../models/users/userModel.js";
import { getCurrentDate } from "../../../helpers/dateTime.js";

/* ==============================
   GET ALL STOCK SIZES
================================ */
export const getAllStockSizes = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const search = req.query.search?.trim() || "";

    const match = {};
    if (search) {
      match.$or = [
        { size: { $regex: search, $options: "i" } },
        { unit: { $regex: search, $options: "i" } },
      ];
    }

    const totalCount = await stockSizeModel.countDocuments(match);

    let query = stockSizeModel
      .find(match)
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .sort({ createdAt: -1 });

    let page = 1;
    let limit = totalCount || 10;

    if (req.query.limit) {
      page = Math.max(1, parseInt(req.query.page) || 1);
      limit = Math.max(1, parseInt(req.query.limit));
      const skip = (page - 1) * limit;
      query = query.skip(skip).limit(limit);
    }

    const data = await query;

    res.json({
      success: true,
      count: data.length,
      totalCount,
      totalPages: req.query.limit ? Math.ceil(totalCount / limit) : 1,
      currentPage: page,
      data,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ==============================
   GET SINGLE STOCK SIZE
================================ */
export const getStockSizeById = async (req, res) => {
  try {
    const { id } = req.params;

    const stockSize = await stockSizeModel
      .findOne({ id })
      .populate("created_by", "name")
      .populate("updated_by", "name");

    if (!stockSize)
      return res
        .status(404)
        .json({ success: false, message: "Stock size not found" });

    res.json({ success: true, data: stockSize });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ==============================
   CREATE STOCK SIZE
================================ */
export const createStockSize = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const userExists = await userModel.exists({ _id: userId, is_active: true });
    if (!userExists)
      return res.status(403).json({ success: false, message: "User inactive" });

    const { width, height, unit, is_active } = req.body;

    if (!width || !height) {
      return res.status(400).json({
        success: false,
        message: "Width and height are required",
      });
    }

    const sizeName = `${width}x${height}`;

    const duplicate = await stockSizeModel.findOne({
      size: sizeName,
    });

    if (duplicate)
      return res.status(409).json({
        success: false,
        message: "Stock size already exists",
      });

    const newStockSize = new stockSizeModel({
      id: nanoid(10),
      size: sizeName,
      width,
      height,
      unit: unit || "inch",
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
    });

    const saved = await newStockSize.save();

    res.status(201).json({
      success: true,
      message: "Stock size created successfully",
      data: saved,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ==============================
   UPDATE STOCK SIZE
================================ */
export const updateStockSize = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    const { width, height, unit, is_active } = req.body;

    const stockSize = await stockSizeModel.findOne({ id });
    if (!stockSize)
      return res
        .status(404)
        .json({ success: false, message: "Stock size not found" });

    if (width && height) {
      stockSize.size = `${width}x${height}`;
      stockSize.width = width;
      stockSize.height = height;
    }

    if (unit) stockSize.unit = unit;
    if (typeof is_active === "boolean") stockSize.is_active = is_active;

    stockSize.updated_by = userId;
    stockSize.updated_at = getCurrentDate();

    const updated = await stockSize.save();

    res.json({
      success: true,
      message: "Stock size updated successfully",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ==============================
   DELETE STOCK SIZE
================================ */
export const deleteStockSize = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await stockSizeModel.findOneAndDelete({ id });
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "Stock size not found" });

    res.json({
      success: true,
      message: "Stock size deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
