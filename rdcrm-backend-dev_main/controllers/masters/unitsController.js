import { nanoid } from "nanoid";
import unitModel from "../../models/masters/unitsModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import { escapeRegex } from "../../helpers/escapeRegex.js";

export const getAllUnits = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit)));
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";
    const category = req.query.category?.trim() || null;

    const sortBy = req.query.sortBy || "createdAt";
    let sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    // Reverse behaviour of boolean sorting
    if (sortBy === "is_active") {
      sortOrder = sortOrder === 1 ? -1 : 1;
    }

    // BUILD QUERY
    let matchQuery = {};

    // Search filter
    if (search) {
      const safeSearch = escapeRegex(search);
      matchQuery.name = { $regex: safeSearch, $options: "i" };
    }

    // Category filter
    if (category && category !== "null" && category !== "undefined") {
      const category_list = category
        .split(",")
        .map((d) => d.trim())
        .filter((d) => d.length > 0);

      if (category_list.length === 1) {
        matchQuery.category = {
          $regex: escapeRegex(category_list[0]),
          $options: "i"
        };
      } else if (category_list.length > 1) {
        matchQuery.category = {
          $in: category_list.map(cat => new RegExp(escapeRegex(cat), 'i'))
        };
      }
    }

    if (typeof req.query.is_active !== "undefined") {
      if (req.query.is_active === "true") matchQuery.is_active = true;
      if (req.query.is_active === "false") matchQuery.is_active = false;
    }

    const totalUnits = await unitModel.countDocuments(matchQuery);

    // MAIN AGGREGATION
    const pipeline = [
      { $match: matchQuery },

      // Join created_by
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

      // Extract updated_by.user → create user id array
      {
        $addFields: {
          updated_by_user_ids: {
            $map: {
              input: "$updated_by",
              as: "u",
              in: "$$u.user",
            },
          },
        },
      },

      // Lookup updated_by users
      {
        $lookup: {
          from: "users",
          localField: "updated_by_user_ids",
          foreignField: "_id",
          as: "updated_by_users",
        },
      },

      // Merge user objects back into updated_by
      {
        $addFields: {
          updated_by: {
            $map: {
              input: "$updated_by",
              as: "u",
              in: {
                user: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$updated_by_users",
                        as: "usr",
                        cond: { $eq: ["$$usr._id", "$$u.user"] },
                      },
                    },
                    0,
                  ],
                },
                date: "$$u.date",
              },
            },
          },
        },
      },

      // Sorting logic
      ...(sortBy
        ? [
          {
            $sort: {
              [sortBy]: sortOrder,
              createdAt: -1,
            },
          },
        ]
        : [{ $sort: { createdAt: -1 } }]),

      // Pagination
      ...(skip > 0 ? [{ $skip: skip }] : []),
      ...(limit > 0 ? [{ $limit: limit }] : []),

      // Cleanup
      {
        $unset: ["updated_by_user_ids", "updated_by_users"],
      },
    ];

    const units = await unitModel.aggregate(pipeline).collation({
      locale: "en",
      strength: 2,
    });

    // Sort values[] array AFTER MongoDB
    if (sortBy === "values") {
      units.sort((a, b) => {
        const aKey = (a.values?.[0] || "").toString().toLowerCase().trim();
        const bKey = (b.values?.[0] || "").toString().toLowerCase().trim();

        return sortOrder === 1
          ? aKey.localeCompare(bKey)
          : bKey.localeCompare(aKey);
      });
    }

    res.status(200).json({
      success: true,
      message: "Units retrieved successfully",
      count: units.length,
      total: totalUnits,
      page,
      totalPages: Math.ceil(totalUnits / limit),
      sortBy,
      sortOrder: sortOrder === 1 ? "asc" : "desc",
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

export const getUnitById = async (req, res) => {
  try {
    const { id } = req.params;
    const unit = await unitModel
      .findOne({ id })
      .populate("created_by")
      .populate("updated_by.user");

    if (!unit) {
      return res.status(404).json({
        success: false,
        message: "Unit not found",
      });
    }

    res.status(200).json({
      success: true,
      data: unit,
    });
  } catch (error) {
    console.error("Error getting unit:", error);
    res.status(500).json({
      success: false,
      message: "Error getting unit",
      error: error.message,
    });
  }
};

export const createUnit = async (req, res) => {
  try {
    const {
      name,
      values,
      is_active,
      category,
      quantity_measured,
      si_unit,
      imperial_unit,
      imperial_symbol,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: name",
      });
    }

    const existingUnit = await unitModel.findOne({ name });
    if (existingUnit) {
      return res.status(409).json({
        success: false,
        message: "Unit already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newUnit = new unitModel({
      id: nanoid(16),
      name,
      values: Array.isArray(values) ? values : [],
      is_active: is_active ?? true,
      category,
      quantity_measured,
      si_unit,
      imperial_unit,
      imperial_symbol,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
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

export const updateUnit = async (req, res) => {
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

    const unit = await unitModel.findOne({ id });
    if (!unit) {
      return res.status(404).json({
        success: false,
        message: "Unit not found",
      });
    }

    if (updateData.name && updateData.name !== unit.name) {
      const nameExists = await unitModel.findOne({ name: updateData.name });
      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: "Unit name already in use",
        });
      }
    }

    await unitModel.updateOne(
      { id },
      {
        $set: {
          ...updateData,
          updated_at: getCurrentDate(),
          updated_by: {
            user: userId,
            date: getCurrentDate(),
          },
        },
      }
    );

    const updatedUnit = await unitModel.findOne({ id });

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

export const deleteUnit = async (req, res) => {
  try {
    const { id } = req.params;

    const unitToDelete = await unitModel.findOne({ id });
    if (!unitToDelete) {
      return res.status(404).json({
        success: false,
        message: "Unit not found",
      });
    }

    const deletedUnit = await unitModel.findOneAndDelete({ id });

    res.status(200).json({
      success: true,
      message: "Unit deleted successfully",
      data: deletedUnit,
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
