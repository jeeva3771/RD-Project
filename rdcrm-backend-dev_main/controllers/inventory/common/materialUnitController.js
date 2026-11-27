import { nanoid } from "nanoid";
import unitModel from "../../../models/inventory/common/materialUnitModel.js";
import userModel from "../../../models/users/userModel.js";
import { getCurrentDate } from "../../../helpers/dateTime.js";

// Get all units
export const getAllUnits = async (req, res) => {
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
        .json({ success: false, message: "User is not active or valid" });

    const units = await unitModel
      .find({ is_active: true })
      .select("id name short_code description is_active created_by created_at")
      .populate({
        path: "created_by",
        select: "name email",
      })
      .populate({
        path: "updated_by",
        select: "name email",
      });

    res.status(200).json({
      success: true,
      count: units.length,
      data: units,
    });
  } catch (error) {
    console.error("Error getting units:", error);
    res.status(500).json({
      success: false,
      message: "Error getting units",
      error: error.message,
    });
  }
};

// Create unit
export const createUnit = async (req, res) => {
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
        .json({ success: false, message: "User is not active or valid" });

    const { name, short_code, description, is_active } = req.body;

    if (!name || !short_code) {
      return res.status(400).json({
        success: false,
        message: "Both name and short_code are required fields",
      });
    }

    // Check for duplicates
    const existingName = await unitModel.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
    });
    const existingShort = await unitModel.findOne({
      short_code: { $regex: `^${short_code}$`, $options: "i" },
    });

    if (existingName && existingShort) {
      return res.status(409).json({
        success: false,
        message: "Both Unit name and short_code already exist",
      });
    } else if (existingName) {
      return res.status(409).json({
        success: false,
        message: "Unit name already exists",
      });
    } else if (existingShort) {
      return res.status(409).json({
        success: false,
        message: "Unit short_code already exists",
      });
    }

    const newUnit = new unitModel({
      id: nanoid(16),
      name: name.trim(),
      short_code: short_code.trim(),
      description: description?.trim() || "",
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
    });

    const savedUnit = await newUnit.save();

    res.status(201).json({
      success: true,
      message: "Unit created successfully",
      data: savedUnit,
    });
  } catch (error) {
    console.error("Error creating unit:", error);
    res.status(500).json({
      success: false,
      message: "Error creating unit",
      error: error.message,
    });
  }
};

// UPDATE UNIT
export const updateUnit = async (req, res) => {
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
        .json({ success: false, message: "User is not active or valid" });

    const { id } = req.params;
    const { name, short_code, description, is_active } = req.body;

    if (!name || !short_code) {
      return res.status(400).json({
        success: false,
        message: "Both name and short_code are required fields",
      });
    }

    const unit = await unitModel.findOne({ id });
    if (!unit) {
      return res.status(404).json({
        success: false,
        message: "Unit not found",
      });
    }

    // Duplicate checks (ignore same record)
    const existingName = await unitModel.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
    });
    const existingShort = await unitModel.findOne({
      short_code: { $regex: `^${short_code}$`, $options: "i" },
    });

    if (
      existingName &&
      existingName.id !== id &&
      existingShort &&
      existingShort.id !== id
    ) {
      return res.status(409).json({
        success: false,
        message: "Both Unit name and short_code already exist",
      });
    } else if (existingName && existingName.id !== id) {
      return res.status(409).json({
        success: false,
        message: "Unit name already exists",
      });
    } else if (existingShort && existingShort.id !== id) {
      return res.status(409).json({
        success: false,
        message: "Unit short_code already exists",
      });
    }

    unit.name = name.trim();
    unit.short_code = short_code.trim();
    unit.description = description?.trim() || "";
    unit.is_active =
      typeof is_active === "boolean" ? is_active : unit.is_active;
    unit.updated_by = userId;
    unit.updated_at = getCurrentDate();

    const updatedUnit = await unit.save();

    res.status(200).json({
      success: true,
      message: "Unit updated successfully",
      data: updatedUnit,
    });
  } catch (error) {
    console.error("Error updating unit:", error);
    res.status(500).json({
      success: false,
      message: "Error updating unit",
      error: error.message,
    });
  }
};

// Delete unit
export const deleteUnit = async (req, res) => {
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
        .json({ success: false, message: "User is not active or valid" });

    const { id } = req.params;

    const deleted = await unitModel.findOneAndDelete({ id });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Unit not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Unit deleted successfully",
      data: deleted,
    });
  } catch (error) {
    console.error("Error deleting unit:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting unit",
      error: error.message,
    });
  }
};
