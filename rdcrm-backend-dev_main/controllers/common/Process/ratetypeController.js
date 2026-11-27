import { nanoid } from "nanoid";
import ratetypeModel from "../../../models/masters/common/Process/rateTypeModel.js";
import { getCurrentDate } from "../../../helpers/dateTime.js";


export const getAllRateTypes = async (req, res) => {
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

    const total = await ratetypeModel.countDocuments(query);
    const rateTypes = await ratetypeModel
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
      message: "Rate types retrieved successfully",
      count: rateTypes.length,
      total,
      page,
      totalPages,
      data: rateTypes,
    });
  } catch (error) {
    console.error("Error getting rate types:", error);
    res.status(500).json({
      success: false,
      message: "Error getting rate types",
      error: error.message,
    });
  }
};


export const getRateTypeById = async (req, res) => {
  try {
    const { id } = req.params;

    const rateType = await ratetypeModel
      .findOne({ id })
      .populate("created_by", "name _id")
      .populate("updated_by.user", "name _id");

    if (!rateType) {
      return res.status(404).json({
        success: false,
        message: "Rate type not found",
      });
    }

    res.status(200).json({
      success: true,
      data: rateType,
    });
  } catch (error) {
    console.error("Error getting rate type:", error);
    res.status(500).json({
      success: false,
      message: "Error getting rate type",
      error: error.message,
    });
  }
};

export const createRateType = async (req, res) => {
  try {
    const { name, is_active } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: name",
      });
    }

    const existing = await ratetypeModel.findOne({ name });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Rate type already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newRateType = new ratetypeModel({
      id: nanoid(16),
      name,
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
    });

    const savedRateType = await newRateType.save();

    res.status(201).json({
      success: true,
      message: "Rate type created successfully",
      data: savedRateType,
    });
  } catch (error) {
    console.error("Error creating rate type:", error);
    res.status(500).json({
      success: false,
      message: "Error creating rate type",
      error: error.message,
    });
  }
};


export const updateRateType = async (req, res) => {
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

    const rateType = await ratetypeModel.findOne({ id });
    if (!rateType) {
      return res.status(404).json({
        success: false,
        message: "Rate type not found",
      });
    }

    // prevent duplicate name
    if (updateData.name && updateData.name !== rateType.name) {
      const exists = await ratetypeModel.findOne({ name: updateData.name });
      if (exists) {
        return res.status(409).json({
          success: false,
          message: "Rate type name already in use",
        });
      }
    }

    const otherUpdates = { ...updateData };
    delete otherUpdates.updated_by;

    await ratetypeModel.updateOne(
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

    const updatedRateType = await ratetypeModel.findOne({ id });

    res.status(200).json({
      success: true,
      message: "Rate type updated successfully",
      data: updatedRateType,
    });
  } catch (error) {
    console.error("Error updating rate type:", error);
    res.status(500).json({
      success: false,
      message: "Error updating rate type",
      error: error.message,
    });
  }
};


export const deleteRateType = async (req, res) => {
  try {
    const { id } = req.params;

    const rateType = await ratetypeModel.findOne({ id });
    if (!rateType) {
      return res.status(404).json({
        success: false,
        message: "Rate type not found",
      });
    }

    const deleted = await ratetypeModel.findOneAndDelete({ id });

    res.status(200).json({
      success: true,
      message: "Rate type deleted successfully",
      data: deleted,
    });
  } catch (error) {
    console.error("Error deleting rate type:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting rate type",
      error: error.message,
    });
  }
};
