import { nanoid } from "nanoid";
import rateUnitModel from "../../../models/inventory/common/rateUnitModel.js";
import userModel from "../../../models/users/userModel.js";
import { getCurrentDate } from "../../../helpers/dateTime.js";

/* ==============================
   GET ALL RATE UNITS
================================ */
export const getAllRateUnits = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const search = req.query.search?.trim() || "";

    const match = {};
    if (search) {
      match.$or = [
        { name: { $regex: search, $options: "i" } },
        { symbol: { $regex: search, $options: "i" } },
      ];
    }

    const totalCount = await rateUnitModel.countDocuments(match);

    let query = rateUnitModel
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
   GET SINGLE RATE UNIT
================================ */
export const getRateUnitById = async (req, res) => {
  try {
    const { id } = req.params;

    const unit = await rateUnitModel
      .findOne({ id })
      .populate("created_by", "name")
      .populate("updated_by", "name");

    if (!unit)
      return res
        .status(404)
        .json({ success: false, message: "Rate unit not found" });

    res.json({ success: true, data: unit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ==============================
   CREATE RATE UNIT
================================ */
export const createRateUnit = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const userExists = await userModel.exists({ _id: userId, is_active: true });
    if (!userExists)
      return res.status(403).json({ success: false, message: "User inactive" });

    const { name, symbol, is_active } = req.body;

    if (!name || !symbol) {
      return res.status(400).json({
        success: false,
        message: "Name and symbol are required",
      });
    }

    const duplicate = await rateUnitModel.findOne({
      $or: [
        { name: { $regex: `^${name}$`, $options: "i" } },
        { symbol: { $regex: `^${symbol}$`, $options: "i" } },
      ],
    });

    if (duplicate)
      return res.status(409).json({
        success: false,
        message: "Rate unit already exists",
      });

    const newUnit = new rateUnitModel({
      id: nanoid(10),
      name: name.trim(),
      symbol: symbol.trim(),
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
    });

    const saved = await newUnit.save();

    res.status(201).json({
      success: true,
      message: "Rate unit created successfully",
      data: saved,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ==============================
   UPDATE RATE UNIT
================================ */
export const updateRateUnit = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    const { name, symbol, is_active } = req.body;

    const unit = await rateUnitModel.findOne({ id });
    if (!unit)
      return res
        .status(404)
        .json({ success: false, message: "Rate unit not found" });

    if (name) unit.name = name.trim();
    if (symbol) unit.symbol = symbol.trim();
    if (typeof is_active === "boolean") unit.is_active = is_active;

    unit.updated_by = userId;
    unit.updated_at = getCurrentDate();

    const updated = await unit.save();

    res.json({
      success: true,
      message: "Rate unit updated successfully",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ==============================
   DELETE RATE UNIT
================================ */
export const deleteRateUnit = async (req, res) => {
  try {
    const { id } = req.params;

    // Optional safety check:
    // const used = await itemModel.exists({ unit: unit._id });
    // if (used) return res.status(400).json({ success:false, message:"Unit in use" });

    const deleted = await rateUnitModel.findOneAndDelete({ id });
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "Rate unit not found" });

    res.json({
      success: true,
      message: "Rate unit deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
