import processModel from "../../models/masters/processModel.js";
import rateCardModel from "../../models/masters/rateCardModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import { nanoid } from "nanoid";
import { mongoose } from "mongoose";
import { escapeRegex } from "../../helpers/escapeRegex.js";

// Create Process
export const createProcess = async (req, res) => {
  try {
    const {
      service_category,
      type,
      is_active,
      department,
      machine,
      rate_parameter,
      has_custom_input,
      unit_type,
      unit,
      variables,
      additional_columns,
      additional_charges,
      remarks,
      available_vendors,
    } = req.body;

    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    // Validate required fields
    if (!service_category) {
      return res.status(400).json({
        success: false,
        message: "Process service category is required",
      });
    }

    // Check for duplicate name
    const nameExists = await processModel.findOne({ service_category: service_category });
    if (nameExists) {
      return res.status(409).json({
        success: false,
        message: "Process service category already exists",
      });
    }

    const newProcess = new processModel({
      id: nanoid(16),
      service_category,
      type,
      is_active: is_active ?? true,
      department,
      machine,
      rate_parameter,
      has_custom_input: has_custom_input ?? false,
      unit_type,
      unit,
      variables,
      additional_columns,
      additional_charges,
      available_vendors,
      remarks,
      created_by: userId,
      created_at: getCurrentDate(),
    });

    const savedProcess = await newProcess.save();

    return res.status(201).json({
      success: true,
      message: "Process created successfully",
      data: savedProcess,
    });
  } catch (error) {
    console.error("Error creating process:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating process",
      error: error.message,
    });
  }
};

// Get All Processes with Pagination and Sorting
export const getAllProcesses = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page)) || 1;
    const limit = req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit))) : null;
    const skip = limit ? (page - 1) * limit : 0;

    const search = req.query.search?.trim() || "";
    const is_active = req.query.is_active;
    const type = req.query.type?.trim() || "";
    const sortField = req.query.sortField?.trim();
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    let query = {};

    if (search) {
      query.name = { $regex: escapeRegex(search), $options: "i" };
    }

    if (type) {
      query.type = type;
    }

    // Handle is_active filter
    if (is_active !== undefined && is_active !== "" && is_active !== null) {
      if (["true", true, "1", 1].includes(is_active)) {
        query.is_active = true;
      } else if (["false", false, "0", 0].includes(is_active)) {
        query.is_active = false;
      }
    }

    const totalProcesses = await processModel.countDocuments(query);
    const totalPages = limit ? Math.ceil(totalProcesses / limit) : 1;

    const pipeline = [
      { $match: query },

      // JOIN department
      {
        $lookup: {
          from: "service_categories",
          localField: "service_category",
          foreignField: "_id",
          as: "serviceCategories",
        },
      },

      {
        $addFields: {
          service_category: { $arrayElemAt: ["$serviceCategories", 0] },
        },
      },

      // JOIN department
      {
        $lookup: {
          from: "departments",
          localField: "department",
          foreignField: "_id",
          as: "department",
        },
      },

      // JOIN machine
      {
        $lookup: {
          from: "machines",
          localField: "machine",
          foreignField: "_id",
          as: "machine",
        },
      },

      // JOIN machine
      {
        $lookup: {
          from: "vendors",
          localField: "available_vendors",
          foreignField: "_id",
          as: "available_vendors",
        },
      },

      // JOIN unit
      {
        $lookup: {
          from: "units",
          localField: "unit",
          foreignField: "_id",
          as: "unit",
        },
      },

      // JOIN additional_columns
      {
        $lookup: {
          from: "processcolumns",
          localField: "additional_columns",
          foreignField: "_id",
          as: "additional_columns",
        },
      },

      // JOIN created_by
      {
        $lookup: {
          from: "users",
          localField: "created_by",
          foreignField: "_id",
          as: "created_by_user",
        },
      },
      {
        $addFields: {
          created_by_user: { $arrayElemAt: ["$created_by_user", 0] },
        },
      },

      // JOIN updated_by (object with user field)
      {
        $lookup: {
          from: "users",
          localField: "updated_by.user",
          foreignField: "_id",
          as: "updated_by_user",
        },
      },
      {
        $addFields: {
          updated_by: {
            user: { $arrayElemAt: ["$updated_by_user", 0] },
            date: "$updated_by.date",
          },
        },
      },

      {
        $addFields: {
          service_category_sort_name: "$service_category.name",
        }
      },

      // Sorting
      ...(sortField === "service_category_name"
        ? [{
          $sort: {
            service_category_sort_name: sortOrder,
            createdAt: -1
          }
        }]
        : sortField !== "service_category_name"
            ? [{
              $sort: {
                [sortField]: sortOrder,
                createdAt: -1
              }
            }]
            : [{ $sort: { createdAt: -1 } }]),

      // sortField
      //   ? { $sort: { [sortField]: sortOrder, createdAt: -1 } }
      //   : { $sort: { createdAt: -1 } },

      // Remove temp fields
      {
        $unset: ["updated_by_user", "serviceCategories"],
      },
    ];

    if (limit) {
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });
    }

    const processes = await processModel
      .aggregate(pipeline)
      .collation({ locale: "en", strength: 2 });

    res.status(200).json({
      success: true,
      count: processes.length,
      total: totalProcesses,
      page,
      totalPages,
      data: processes,
    });
  } catch (error) {
    console.error("Error getting processes:", error);
    res.status(500).json({
      success: false,
      message: "Error getting processes",
      error: error.message,
    });
  }
};

// Get Process by ID
export const getProcessById = async (req, res) => {
  try {
    const { id } = req.params;

    const process = await processModel.findOne({ id })
      .populate('service_category')
      .populate("department")
      .populate("machine")
      .populate("unit")
      .populate({
        path: "available_vendors",
        populate: [
          {
            path: "service_category",
            model: "service_category" // Update with your actual model name
          },
          {
            path: "contract_type",
            model: "contract_type" // Update with your actual model name
          }
        ]
      })
      .populate("additional_columns")
      .populate("created_by", "name email")
      .populate("updated_by.user", "name email");

    if (!process) {
      return res.status(404).json({
        success: false,
        message: "Process not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Process fetched successfully",
      data: process,
    });
  } catch (error) {
    console.error("Error fetching process:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching process",
      error: error.message,
    });
  }
};

// Update Process
export const updateProcess = async (req, res) => {
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

    const process = await processModel.findOne({ id });
    if (!process) {
      return res.status(404).json({
        success: false,
        message: "Process not found",
      });
    }

    console.log("updateData.service_category", new mongoose.Types.ObjectId(updateData.service_category), process.service_category)
    // Check for duplicate name
    if (updateData.service_category && !(new mongoose.Types.ObjectId(updateData.service_category).equals(process.service_category))) {
      const serviceExists = await processModel.findOne({ service_category: updateData.service_category });
      if (serviceExists) {
        return res.status(409).json({
          success: false,
          message: "Service name already in use",
        });
      }
    }

    const otherUpdates = { ...updateData };
    delete otherUpdates.updated_by;

    await processModel.updateOne(
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

    const updatedProcess = await processModel.findOne({ id });

    res.status(200).json({
      success: true,
      message: "Process updated successfully",
      data: updatedProcess,
    });
  } catch (error) {
    console.error("Error updating process:", error);
    res.status(500).json({
      success: false,
      message: "Error updating process",
      error: error.message,
    });
  }
};

// Delete Process
export const deleteProcess = async (req, res) => {
  try {
    const { id } = req.params;

    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const deletedProcess = await processModel.findOneAndDelete({ _id: id });

    if (!deletedProcess) {
      return res.status(404).json({
        success: false,
        message: "Process not found",
      });
    }

    // Delete all rate cards associated with this process
    await rateCardModel.deleteMany({ process: id });

    return res.status(200).json({
      success: true,
      message: "Process and associated rate cards deleted successfully",
      data: deletedProcess,
    });
  } catch (error) {
    console.error("Error deleting process:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting process",
      error: error.message,
    });
  }
};

//check service category exists
export const checkServiceCategoryExists = async (req, res) => {
  try {
    const { service_category } = req.query;

    if (!service_category) {
      return res.status(400).json({
        success: false,
        message: "Service category is required",
      });
    }

    const exists = await processModel.findOne({
      service_category: service_category
    });

    return res.status(200).json({
      success: true,
      exists: !!exists,
      message: exists
        ? "Service category already exists"
        : "Service category is available",
    });
  } catch (error) {
    console.error("Error checking service category:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking service category",
      error: error.message,
    });
  }
};
