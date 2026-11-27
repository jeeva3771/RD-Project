import { nanoid } from "nanoid";
import processColumnModel from "../../models/masters/processColumnModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import processModel from "../../models/masters/processModel.js";
import { escapeRegex } from "../../helpers/escapeRegex.js";

export const getAllProcessColumns = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit)));
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";

    const sortBy = req.query.sortBy || "createdAt";
    let sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    // Reverse logic for boolean sorting
    if (sortBy === "is_active") {
      sortOrder = sortOrder === 1 ? -1 : 1;
    }

    // QUERY
    let matchQuery = {};


    // Search filter
        if (search) {
          const safeSearch = escapeRegex(search);
          matchQuery.name = { $regex: safeSearch, $options: "i" };
        }

    if (typeof req.query.is_active !== "undefined") {
      if (req.query.is_active === "true") matchQuery.is_active = true;
      if (req.query.is_active === "false") matchQuery.is_active = false;
    }

    const totalColumns = await processColumnModel.countDocuments(matchQuery);

    // AGGREGATION PIPELINE
    const pipeline = [
      { $match: matchQuery },

      // Join created_by user
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

      // Extract updated_by.user IDs
      {
        $addFields: {
          updated_by_user_ids: {
            $map: { input: "$updated_by", as: "u", in: "$$u.user" },
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

      // Merge updated_by details
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

      // Sorting
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

      // Remove temporary fields
      {
        $unset: ["updated_by_user_ids", "updated_by_users"],
      },
    ];

    const columns = await processColumnModel.aggregate(pipeline).collation({
      locale: "en",
      strength: 2,
    });

    const totalPages = Math.ceil(totalColumns / limit);

    res.status(200).json({
      success: true,
      message: "Process columns retrieved successfully",
      count: columns.length,
      total: totalColumns,
      page,
      totalPages,
      sortBy,
      sortOrder: sortOrder === 1 ? "asc" : "desc",
      data: columns,
    });
  } catch (error) {
    console.error("Error getting process columns:", error);
    res.status(500).json({
      success: false,
      message: "Error getting process columns",
      error: error.message,
    });
  }
};

export const getProcessColumnById = async (req, res) => {
  try {
    const { id } = req.params;
    const column = await processColumnModel
      .findOne({ id })
      .populate("created_by")
      .populate("updated_by.user");

    if (!column) {
      return res.status(404).json({
        success: false,
        message: "Process column not found",
      });
    }

    res.status(200).json({
      success: true,
      data: column,
    });
  } catch (error) {
    console.error("Error getting process column:", error);
    res.status(500).json({
      success: false,
      message: "Error getting process column",
      error: error.message,
    });
  }
};


export const createProcessColumn = async (req, res) => {
  try {
    const { name, is_active } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name",
      });
    }

    const existingColumn = await processColumnModel.findOne({ name });
    if (existingColumn) {
      return res.status(409).json({
        success: false,
        message: "Process column already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newColumn = new processColumnModel({
      id: nanoid(16),
      name,
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
    });

    const savedColumn = await newColumn.save();

    res.status(201).json({
      success: true,
      message: "Process column created successfully",
      data: savedColumn,
    });
  } catch (error) {
    console.error("Error creating process column:", error);
    res.status(500).json({
      success: false,
      message: "Error creating process column",
      error: error.message,
    });
  }
};

export const updateProcessColumn = async (req, res) => {
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

    const column = await processColumnModel.findOne({ id });
    if (!column) {
      return res.status(404).json({
        success: false,
        message: "Process column not found",
      });
    }

    if (updateData.name && updateData.name !== column.name) {
      const nameExists = await processColumnModel.findOne({
        name: updateData.name,
      });
      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: "Process column name already in use",
        });
      }
    }

    const otherUpdates = { ...updateData };
    delete otherUpdates.updated_by;

    await processColumnModel.updateOne(
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

    const updatedColumn = await processColumnModel.findOne({ id });

    res.status(200).json({
      success: true,
      message: "Process column updated successfully",
      data: updatedColumn,
    });
  } catch (error) {
    console.error("Error updating process column:", error);
    res.status(500).json({
      success: false,
      message: "Error updating process column",
      error: error.message,
    });
  }
};

export const deleteProcessColumn = async (req, res) => {
  try {
    const { id } = req.params;

    const columnToDelete = await processColumnModel.findOne({ id });

    if (!columnToDelete) {
      return res.status(404).json({
        success: false,
        message: "Process column not found",
      });
    }

    const isProcessInUse = await processModel.findOne({
      additional_columns: { $in: [columnToDelete._id] },
    });

    if (isProcessInUse) {
      return res.status(400).json({
        success: false,
        message: "Process Column cannot be deleted because it is in use.",
      });
    }



    const deletedColumn = await processColumnModel.findOneAndDelete({ id });

    res.status(200).json({
      success: true,
      message: "Process column deleted successfully",
      data: deletedColumn,
    });
  } catch (error) {
    console.error("Error deleting process column:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting process column",
      error: error.message,
    });
  }
};
