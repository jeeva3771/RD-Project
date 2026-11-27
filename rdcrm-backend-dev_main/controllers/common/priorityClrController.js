import { nanoid } from "nanoid";
import priorityClrModel from "../../models/masters/common/priorityClrModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import userModel from "../../models/users/userModel.js";

// Get All Priority Colors
export const getAllPriorityClr = async (req, res) => {
  try {

    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const userExists = await userModel.exists({ _id: userId, is_active: true });
    if (!userExists)
      return res.status(403).json({ success: false, message: "User inactive" });

    const data = await priorityClrModel
      .find({ is_active: true })
      .select("id name priority created_at updated_at");

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Error fetching priority colors:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create Priority Color
export const createPriorityClr = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const userExists = await userModel.exists({ _id: userId, is_active: true });
    if (!userExists)
      return res.status(403).json({ success: false, message: "User inactive" });

    const { name, is_active, days_from, days_to, color } = req.body;

    if (!name || !days_from || !days_to || !color)
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name, days_from, days_to, color",
      });

    const existing = await priorityClrModel.findOne({
      $or: [
        // Duplicate Name (case-insensitive)
        { name: { $regex: `^${name}$`, $options: "i" } },

        // Same Color Code (case-insensitive)
        { "priority.color": { $regex: `^${color}$`, $options: "i" } },

        // Overlapping Day Range
        {
          $and: [
            { "priority.days_from": { $lte: days_to } },
            { "priority.days_to": { $gte: days_from } },
          ],
        },
      ],
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "Priority color conflict — same name, color, or overlapping days already exist",
      });
    }

    const newPriority = new priorityClrModel({
      id: nanoid(16),
      name,
      is_active: is_active ?? true,
      priority: { days_from, days_to, color },
      created_by: userId,
      created_at: getCurrentDate(),
    });

    const saved = await newPriority.save();

    res.status(201).json({
      success: true,
      message: "Priority color created successfully",
      data: saved,
    });
  } catch (error) {
    console.error("Error creating priority color:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Single Priority Color
export const getPriorityClrById = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const userExists = await userModel.exists({ _id: userId, is_active: true });
    if (!userExists)
      return res.status(403).json({ success: false, message: "User inactive" });

    const { id } = req.params;
    const record = await priorityClrModel.findOne({ id });
    if (!record)
      return res.status(404).json({ success: false, message: "Not found" });

    res.status(200).json({ success: true, data: record });
  } catch (error) {
    console.error("Error fetching priority color:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Priority Color
export const updatePriorityClr = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const userExists = await userModel.exists({ _id: userId, is_active: true });
    if (!userExists)
      return res.status(403).json({ success: false, message: "User inactive" });

    const { id } = req.params;
    const { name, is_active, days_from, days_to, color } = req.body;

    const record = await priorityClrModel.findOne({ id });
    if (!record)
      return res.status(404).json({ success: false, message: "Not found" });

    // Mandatory fields check
    if (!color)
      return res
        .status(400)
        .json({ success: false, message: "Color is required for update" });

    const existing = await priorityClrModel.findOne({
      id: { $ne: record.id },
      $or: [
        { name: { $regex: `^${name}$`, $options: "i" } },
        { "priority.color": { $regex: `^${color}$`, $options: "i" } },
        {
          $and: [
            { "priority.days_from": { $lte: days_to ?? record.priority.days_to } },
            { "priority.days_to": { $gte: days_from ?? record.priority.days_from } },
          ],
        },
      ],
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "Conflict — another priority record with same name, color, or overlapping days already exists",
      });
    }

    record.name = name ?? record.name;
    record.is_active = is_active ?? record.is_active;
    record.priority = {
      days_from: days_from ?? record.priority.days_from,
      days_to: days_to ?? record.priority.days_to,
      color,
    };
    record.updated_by = userId;
    record.updated_at = getCurrentDate();

    const updated = await record.save();

    res.status(200).json({
      success: true,
      message: "Priority color updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating priority color:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Priority Color
export const deletePriorityClr = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const userExists = await userModel.exists({ _id: userId, is_active: true });
    if (!userExists)
      return res.status(403).json({ success: false, message: "User inactive" });

    const { id } = req.params;
    const deleted = await priorityClrModel.findOneAndDelete({ id });
    if (!deleted)
      return res.status(404).json({ success: false, message: "Not found" });

    res.status(200).json({
      success: true,
      message: "Priority color deleted successfully",
      data: deleted,
    });
  } catch (error) {
    console.error("Error deleting priority color:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
