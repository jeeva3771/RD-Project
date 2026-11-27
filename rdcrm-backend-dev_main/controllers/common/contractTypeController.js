import { nanoid } from "nanoid";
import contractTypeModel from "../../models/masters/common/contractTypeModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";

export const getAllContractTypes = async (req, res) => {
  try {
     const query = {};

    // FILTER is_active
    if (typeof req.query.is_active !== "undefined") {
      query.is_active = req.query.is_active === "true";
    }

    // DYNAMIC SORTING
    const allowedSortFields = ["name", "createdAt", "updatedAt"];

    const sortField =
      req.query.sortBy && allowedSortFields.includes(req.query.sortBy)
        ? req.query.sortBy
        : "createdAt";

    const sortOrder = req.query.order === "asc" ? 1 : -1;

    const sortOption = { [sortField]: sortOrder };

    const contractTypes = await contractTypeModel
      .find(query)
      .collation({ locale: "en", strength: 2 })
      .sort(sortOption)
      .select("-created_at -updated_by -updated_at")
      .populate({
        path: "created_by",
        select: "-password -permission -created_at -updated_by -updated_at",
      })
      .populate({
        path: "updated_by.user",
        select: "-password -permission -created_at -updated_by -updated_at",
      });

    res.status(200).json({
      success: true,
      count: contractTypes.length,
      data: contractTypes,
    });
  } catch (error) {
    console.error("Error getting contract types:", error);
    res.status(500).json({
      success: false,
      message: "Error getting contract types",
      error: error.message,
    });
  }
};

export const insertContractType = async (req, res) => {
  try {
    const { name, is_active } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: name",
      });
    }

    const existingContractType = await contractTypeModel.findOne({ name });
    if (existingContractType) {
      return res.status(409).json({
        success: false,
        message: "Contract type already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newContractType = new contractTypeModel({
      id: nanoid(16),
      name,
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
    });

    const savedContractType = await newContractType.save();

    res.status(201).json({
      success: true,
      message: "Contract type created successfully",
      data: savedContractType,
    });
  } catch (error) {
    console.error("Error creating contract type:", error);
    res.status(500).json({
      success: false,
      message: "Error creating contract type",
      error: error.message,
    });
  }
};

export const deleteContractType = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedContractType = await contractTypeModel.findOneAndDelete({
      id,
    });

    if (!deletedContractType) {
      return res.status(404).json({
        success: false,
        message: "Contract type not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Contract type deleted successfully",
      data: deletedContractType,
    });
  } catch (error) {
    console.error("Error deleting contract type:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting contract type",
      error: error.message,
    });
  }
};
