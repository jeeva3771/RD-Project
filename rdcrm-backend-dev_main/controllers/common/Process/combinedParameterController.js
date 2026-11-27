import { nanoid } from "nanoid";
import combinedparameterModel from "../../../models/masters/common/Process/combinedparameterModel.js";
import { getCurrentDate } from "../../../helpers/dateTime.js";

export const getAllCombinedParameters = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit)));
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";
    const query = {};

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

  
    let sortOption = { createdAt: -1 };

    if (req.query.order) {
      const sortOrder = req.query.order === "desc" ? -1 : 1;
      sortOption = { name: sortOrder };
    }
  


    if (typeof req.query.is_active !== "undefined") {
      if (req.query.is_active === "true") query.is_active = true;
      else if (req.query.is_active === "false") query.is_active = false;
    }

    const total = await combinedparameterModel.countDocuments(query);
    const parameters = await combinedparameterModel
      .find(query)
      .collation({ locale: "en", strength: 2 })
      .populate("created_by", "name _id")
      .populate("updated_by.user", "name _id")
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      message: "Combined parameters retrieved successfully",
      count: parameters.length,
      total,
      page,
      totalPages,
      data: parameters,
    });
  } catch (error) {
    console.error("Error getting combined parameters:", error);
    res.status(500).json({
      success: false,
      message: "Error getting combined parameters",
      error: error.message,
    });
  }
};

export const getCombinedParameterById = async (req, res) => {
  try {
    const { id } = req.params;

    const parameter = await combinedparameterModel
      .findOne({ id })
      .populate("created_by", "name _id")
      .populate("updated_by.user", "name _id");

    if (!parameter) {
      return res.status(404).json({
        success: false,
        message: "Combined parameter not found",
      });
    }

    res.status(200).json({
      success: true,
      data: parameter,
    });
  } catch (error) {
    console.error("Error getting combined parameter:", error);
    res.status(500).json({
      success: false,
      message: "Error getting combined parameter",
      error: error.message,
    });
  }
};

export const createCombinedParameter = async (req, res) => {
  try {
    const { name, is_active } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: name",
      });
    }

    const existing = await combinedparameterModel.findOne({ name });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Combined parameter already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newParameter = new combinedparameterModel({
      id: nanoid(16),
      name,
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
    });

    const savedParameter = await newParameter.save();

    res.status(201).json({
      success: true,
      message: "Combined parameter created successfully",
      data: savedParameter,
    });
  } catch (error) {
    console.error("Error creating combined parameter:", error);
    res.status(500).json({
      success: false,
      message: "Error creating combined parameter",
      error: error.message,
    });
  }
};

export const updateCombinedParameter = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const parameter = await combinedparameterModel.findOne({ id });
    if (!parameter) {
      return res.status(404).json({
        success: false,
        message: "Combined parameter not found",
      });
    }

    if (updateData.name && updateData.name !== parameter.name) {
      const exists = await combinedparameterModel.findOne({ name: updateData.name });
      if (exists) {
        return res.status(409).json({
          success: false,
          message: "Combined parameter name already in use",
        });
      }
    }

    const otherUpdates = { ...updateData };
    delete otherUpdates.updated_by;

    await combinedparameterModel.updateOne(
      { id },
      {
        $set: {
          ...otherUpdates,
          updated_at: getCurrentDate(),
          updated_by: {
            user: userId,
            date: getCurrentDate(),
          },
        },
      }
    );

    const updatedParameter = await combinedparameterModel.findOne({ id });

    res.status(200).json({
      success: true,
      message: "Combined parameter updated successfully",
      data: updatedParameter,
    });
  } catch (error) {
    console.error("Error updating combined parameter:", error);
    res.status(500).json({
      success: false,
      message: "Error updating combined parameter",
      error: error.message,
    });
  }
};

export const deleteCombinedParameter = async (req, res) => {
  try {
    const { id } = req.params;

    const parameter = await combinedparameterModel.findOne({ id });
    if (!parameter) {
      return res.status(404).json({
        success: false,
        message: "Combined parameter not found",
      });
    }

    const deleted = await combinedparameterModel.findOneAndDelete({ id });

    res.status(200).json({
      success: true,
      message: "Combined parameter deleted successfully",
      data: deleted,
    });
  } catch (error) {
    console.error("Error deleting combined parameter:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting combined parameter",
      error: error.message,
    });
  }
};