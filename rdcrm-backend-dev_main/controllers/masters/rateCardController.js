import rateCardModel from "../../models/masters/rateCardModel.js";
import processModel from "../../models/masters/processModel.js";
import vendorModel from "../../models/masters/vendorModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import { nanoid } from "nanoid";
import { mongoose } from "mongoose";

// Validate variable rates - check if price exists and is valid
const validateVariableRates = (variableRates) => {
  if (!variableRates || !Array.isArray(variableRates)) {
    return { isValid: true, errors: [] };
  }

  const errors = [];

  variableRates.forEach((rate, index) => {
    if (rate.price === undefined || rate.price === null || rate.price === "") {
      errors.push(`Price is required for variable rate at index ${index}`);
    } else if (typeof rate.price !== "number" || isNaN(rate.price)) {
      errors.push(`Price must be a valid number for variable rate at index ${index}`);
    } else if (rate.price < 0) {
      errors.push(`Price cannot be negative for variable rate at index ${index}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Create Rate Card
export const createRateCard = async (req, res) => {
  try {
    const {
      process_id,
      rate_unit,
      variable_rates,
      is_internal,
      vendor,
      is_active,
      remarks,
    } = req.body;

    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    // Validate required fields
    if (!process_id) {
      return res.status(400).json({
        success: false,
        message: "Process ID is required",
      });
    }

    // Validate vendor is required when not internal
    if (!is_internal && !vendor) {
      return res.status(400).json({
        success: false,
        message: "Vendor is required when rate card is not internal",
      });
    }

    // Check if process exists
    const processExists = await processModel.findById(process_id);
    if (!processExists) {
      return res.status(404).json({
        success: false,
        message: "Process not found",
      });
    }

    // Check if vendor exists (when not internal)
    if (!is_internal && vendor) {
      const vendorExists = await vendorModel.findById(vendor);
      if (!vendorExists) {
        return res.status(404).json({
          success: false,
          message: "Vendor not found",
        });
      }
    }

    // Check for duplicate rate card
    let duplicateQuery = { process_id };

    if (is_internal) {
      // Check if internal rate card already exists for this process
      duplicateQuery.is_internal = true;
    } else {
      // Check if rate card already exists for this process-vendor combination
      duplicateQuery.vendor = vendor;
      duplicateQuery.is_internal = false;
    }

    const existingRateCard = await rateCardModel.findOne(duplicateQuery);

    if (existingRateCard) {
      const message = is_internal
        ? "Internal rate card already exists for this process"
        : "Rate card already exists for this process and vendor combination";

      return res.status(409).json({
        success: false,
        message: message,
      });
    }

    // Validate variable rates for price
    if (variable_rates) {
      const validation = validateVariableRates(variable_rates);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Invalid variable rates",
          errors: validation.errors,
        });
      }
    }

    // Prepare rate card data
    const rateCardData = {
      id: nanoid(16),
      process_id,
      rate_unit,
      variable_rates,
      is_internal: is_internal ?? false,
      is_active: is_active ?? true,
      remarks,
      created_by: userId,
      created_at: getCurrentDate(),
    };

    // Only add vendor if not internal and vendor is provided
    if (!is_internal && vendor) {
      rateCardData.vendor = vendor;
    }

    const newRateCard = new rateCardModel(rateCardData);
    const savedRateCard = await newRateCard.save();

    return res.status(201).json({
      success: true,
      message: "Rate card created successfully",
      data: savedRateCard,
    });
  } catch (error) {
    console.error("Error creating rate card:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating rate card",
      error: error.message,
    });
  }
};

// Get All Rate Cards with Pagination and Sorting
export const getAllRateCards = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page)) || 1;
    const limit = req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit))) : null;
    const skip = limit ? (page - 1) * limit : 0;

    const is_active = req.query.is_active;
    const process_id = req.query.process_id?.trim() || "";
    const sortField = req.query.sortField?.trim();
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    let query = {};

    // if (search) {
    //   query.name = { $regex: search, $options: "i" };
    // }

    if (process_id) {
      query.process_id = new mongoose.Types.ObjectId(process_id);
    }

    // Handle is_active filter
    if (is_active !== undefined && is_active !== "" && is_active !== null) {
      if (["true", true, "1", 1].includes(is_active)) {
        query.is_active = true;
      } else if (["false", false, "0", 0].includes(is_active)) {
        query.is_active = false;
      }
    }

    const totalRateCards = await rateCardModel.countDocuments(query);
    const totalPages = limit ? Math.ceil(totalRateCards / limit) : 1;

    const pipeline = [
      { $match: query },

      // JOIN process
      {
        $lookup: {
          from: "processes",
          localField: "process_id",
          foreignField: "_id",
          as: "process",
        },
      },
      {
        $addFields: {
          process: { $arrayElemAt: ["$process", 0] },
        },
      },

      // JOIN service_category for process
      {
        $lookup: {
          from: "service_categories", // Update with your actual collection name
          localField: "process.service_category",
          foreignField: "_id",
          as: "process_service_category",
        },
      },

      // Update vendor object with populated fields
      {
        $addFields: {
          process: {
            $cond: {
              if: { $ne: ["$process", null] },
              then: {
                $mergeObjects: [
                  "$process",
                  {
                    service_category: { $arrayElemAt: ["$process_service_category", 0] },
                  },
                ],
              },
              else: null,
            },
          },
        },
      },

      // JOIN vendors (convert array to object)
      {
        $lookup: {
          from: "vendors",
          localField: "vendor",
          foreignField: "_id",
          as: "vendor_data",
        },
      },
      {
        $addFields: {
          vendor: { $arrayElemAt: ["$vendor_data", 0] },
        },
      },

      // JOIN service_category for vendor
      {
        $lookup: {
          from: "service_categories", // Update with your actual collection name
          localField: "vendor.service_category",
          foreignField: "_id",
          as: "vendor_service_category",
        },
      },

      // JOIN contract_type for vendor
      {
        $lookup: {
          from: "contract_types", // Update with your actual collection name
          localField: "vendor.contract_type",
          foreignField: "_id",
          as: "vendor_contract_type",
        },
      },

      // Update vendor object with populated fields
      {
        $addFields: {
          vendor: {
            $cond: {
              if: { $ne: ["$vendor", null] },
              then: {
                $mergeObjects: [
                  "$vendor",
                  {
                    service_category: { $arrayElemAt: ["$vendor_service_category", 0] },
                    contract_type: { $arrayElemAt: ["$vendor_contract_type", 0] },
                  },
                ],
              },
              else: null,
            },
          },
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

      // Sorting
      sortField
        ? { $sort: { [sortField]: sortOrder, createdAt: -1 } }
        : { $sort: { createdAt: -1 } },

      // Remove temp fields
      {
        $unset: [
          "updated_by_user",
          "vendor_data",
          "vendor_service_category",
          "vendor_contract_type",
        ],
      },
    ];

    if (limit) {
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });
    }

    const rateCards = await rateCardModel
      .aggregate(pipeline)
      .collation({ locale: "en", strength: 2 });

    res.status(200).json({
      success: true,
      count: rateCards.length,
      total: totalRateCards,
      page,
      totalPages,
      data: rateCards,
    });
  } catch (error) {
    console.error("Error getting rate cards:", error);
    res.status(500).json({
      success: false,
      message: "Error getting rate cards",
      error: error.message,
    });
  }
};

// Get Rate Card by ID
export const getRateCardById = async (req, res) => {
  try {
    const { id } = req.params;

    const rateCard = await rateCardModel.findOne({ id })
      .populate("process_id")
      .populate("vendor")
      .populate("created_by", "name email")
      .populate("updated_by.user", "name email");

    if (!rateCard) {
      return res.status(404).json({
        success: false,
        message: "Rate card not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Rate card fetched successfully",
      data: rateCard,
    });
  } catch (error) {
    console.error("Error fetching rate card:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching rate card",
      error: error.message,
    });
  }
};

// Get Rate Cards by Process ID
export const getRateCardsByProcessId = async (req, res) => {
  try {
    const { processId } = req.params;

    const rateCards = await rateCardModel.find({ process_id: processId })
      .populate("process_id")
      .populate("created_by", "name email")
      .populate("updated_by.user", "name email");

    return res.status(200).json({
      success: true,
      message: "Rate cards fetched successfully",
      data: rateCards,
    });
  } catch (error) {
    console.error("Error fetching rate cards:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching rate cards",
      error: error.message,
    });
  }
};

// Update Rate Card
export const updateRateCard = async (req, res) => {
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

    const rateCard = await rateCardModel.findOne({ id });
    if (!rateCard) {
      return res.status(404).json({
        success: false,
        message: "Rate card not found",
      });
    }

    // Prevent changing process_id
    if (updateData.process_id && updateData.process_id.toString() !== rateCard.process_id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Process ID cannot be changed",
      });
    }

    // Prevent changing is_internal
    if (updateData.is_internal !== undefined && updateData.is_internal !== rateCard.is_internal) {
      return res.status(400).json({
        success: false,
        message: "Internal/External type cannot be changed",
      });
    }

    // Prevent changing vendor
    if (updateData.vendor !== undefined) {
      const existingVendor = rateCard.vendor?.toString() || null;
      const newVendor = updateData.vendor?.toString() || null;

      if (existingVendor !== newVendor) {
        return res.status(400).json({
          success: false,
          message: "Vendor cannot be changed",
        });
      }
    }

    // Validate variable rates for price
    if (updateData.variable_rates) {
      const validation = validateVariableRates(updateData.variable_rates);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Invalid variable rates",
          errors: validation.errors,
        });
      }
    }

    // Remove fields that shouldn't be updated
    const otherUpdates = { ...updateData };
    delete otherUpdates.updated_by;
    delete otherUpdates.process_id;
    delete otherUpdates.is_internal;
    delete otherUpdates.vendor;

    await rateCardModel.updateOne(
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

    const updatedRateCard = await rateCardModel.findOne({ id });

    res.status(200).json({
      success: true,
      message: "Rate card updated successfully",
      data: updatedRateCard,
    });
  } catch (error) {
    console.error("Error updating rate card:", error);
    res.status(500).json({
      success: false,
      message: "Error updating rate card",
      error: error.message,
    });
  }
};

// Delete Rate Card
export const deleteRateCard = async (req, res) => {
  try {
    const { id } = req.params;

    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const deletedRateCard = await rateCardModel.findOneAndDelete({ id });

    if (!deletedRateCard) {
      return res.status(404).json({
        success: false,
        message: "Rate card not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Rate card deleted successfully",
      data: deletedRateCard,
    });
  } catch (error) {
    console.error("Error deleting rate card:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting rate card",
      error: error.message,
    });
  }
};

// Check if rate card exists (add this to your rateCard controller)
export const checkRateCardExists = async (req, res) => {
  try {
    const { process_id, is_internal, vendor } = req.query;


    if (!process_id) {
      return res.status(400).json({
        success: false,
        message: "Process ID is required",
      });
    }

    // Validate process_id is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(process_id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Process ID format",
      });
    }

    let query = {
      process_id: new mongoose.Types.ObjectId(process_id)
    };

    if (is_internal === 'true' || is_internal === true) {
      query.is_internal = true;
    } else if (is_internal === 'false' || is_internal === false) {
      query.is_internal = false;
      if (vendor) {
        // Validate vendor is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(vendor)) {
          return res.status(400).json({
            success: false,
            message: "Invalid Vendor ID format",
          });
        }
        query.vendor = new mongoose.Types.ObjectId(vendor);
      }
    }

    const existingRateCard = await rateCardModel.findOne(query);

    // Always return success: true with exists boolean
    return res.status(200).json({
      success: true,
      exists: !!existingRateCard, // false when database is empty or no match
      data: existingRateCard ? {
        id: existingRateCard.id || existingRateCard._id,
        process_id: existingRateCard.process_id,
        is_internal: existingRateCard.is_internal,
        vendor: existingRateCard.vendor,
      } : null,
    });
  } catch (error) {
    console.error("Error checking rate card existence:", error);
    // Even on error, return success with exists: false to not block the form
    return res.status(200).json({
      success: true,
      exists: false,
      data: null,
      message: "Error checking rate card, defaulting to no duplicate found",
    });
  }
};