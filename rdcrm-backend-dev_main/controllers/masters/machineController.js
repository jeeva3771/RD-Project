import { nanoid } from "nanoid";
import machineModel from "../../models/masters/machineModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import { escapeRegex } from "../../helpers/escapeRegex.js";
import mongoose from "mongoose";

export const getAllMachines = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit)));
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";
    const departmentName = req.query.departmentname?.trim() || "";

    const sortField = req.query.sortBy?.trim() || "";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    let query = {};

    // Active Status Filter
    if (req.query.is_active === 'true') {
      // Assuming true or undefined means active in some schemas, but usually just boolean true
      query.is_active = { $ne: false }; 
    } else if (req.query.is_active === 'false') {
      query.is_active = false;
    }

    // Period filter based on commission_date
    const { filterType, filterValue } = req.query;
    if (filterType && filterType !== 'all' && filterValue) {
        let startDate, endDate;
        if (filterType === 'today') {
            const [year, month, day] = filterValue.split('-');
            startDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            endDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else if (filterType === 'week') {
            const parts = filterValue.split('-W');
            const y = parseInt(parts[0]);
            const w = parseInt(parts[1]);
            
            const simple = new Date(y, 0, 1 + (w - 1) * 7);
            const dow = simple.getDay();
            const ISOweekStart = simple;
            if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
            else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
            
            startDate = new Date(ISOweekStart);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
        } else if (filterType === 'month') {
            const [year, m] = filterValue.split('-');
            startDate = new Date(parseInt(year), parseInt(m) - 1, 1);
            endDate = new Date(parseInt(year), parseInt(m), 0);
        } else if (filterType === 'fy') {
            const startYear = parseInt(filterValue);
            startDate = new Date(startYear, 3, 1); // April 1st
            endDate = new Date(startYear + 1, 2, 31); // March 31st
        }

        if (startDate && endDate) {
            const toYYYYMMDD = (d) => {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
            query.commission_date = { 
                $gte: toYYYYMMDD(startDate), 
                $lte: toYYYYMMDD(endDate) 
            };
        }
    }

    // Search filter
    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { machine_number: { $regex: safeSearch, $options: "i" } },
        { location: { $regex: safeSearch, $options: "i" } },
      ];
    }

    // Department filter
    if (departmentName) {
      const departmentIds = departmentName
        .split(",")
        .map((d) => d.trim())
        .filter((d) => d.length > 0)
        .map((id) => {
          try {
            // Alternative method
            if (/^[0-9a-fA-F]{24}$/.test(id)) {
              return mongoose.Types.ObjectId.createFromHexString(id);
            }
            console.error(`Invalid ObjectId format: ${id}`);
            return null;
          } catch (err) {
            console.error(`Failed to convert ObjectId: ${id}`, err.message);
            return null;
          }
        })
        .filter((id) => id !== null);
      if (departmentIds.length > 0) {
        query.department = { $in: departmentIds };
      } else {
        // No matching departments found, return empty result
        query.department = { $in: [] };
      }
    }

    const totalMachines = await machineModel.countDocuments(query);
    
    // Calculate metrics across all matched records (not just the paginated slice)
    const allMatches = await machineModel.find(query).select('gross_cost book_value accumulated_depreciation').lean();
    let metrics = { totalCost: 0, totalBook: 0, totalDep: 0 };
    for (const m of allMatches) {
        const cost = Number(m.gross_cost) || 0;
        const book = Number(m.book_value) || 0;
        metrics.totalCost += cost;
        metrics.totalBook += book;
        metrics.totalDep += Number(m.accumulated_depreciation) || Math.max(0, cost - book);
    }

    const skipValue = Number(skip);
    const limitValue = Number(limit);

    const pipeline = [
      { $match: query },

      // Join department
      {
        $lookup: {
          from: "departments",
          localField: "department",
          foreignField: "_id",
          as: "department_lookup",
        },
      },
      {
        $addFields: {
          department_obj: { $arrayElemAt: ["$department_lookup", 0] },
        },
      },

      // Lookup created_by user
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

      // Extract updated_by.user → build updated_by_user_ids array
      {
        $addFields: {
          safe_updated_by: {
            $cond: {
              if: { $isArray: "$updated_by" },
              then: "$updated_by",
              else: [],
            },
          },
        },
      },
      {
        $addFields: {
          updated_by_user_ids: {
            $map: {
              input: "$safe_updated_by",
              as: "u",
              in: "$$u.user",
            },
          },
        },
      },

      // Lookup users for updated_by
      {
        $lookup: {
          from: "users",
          localField: "updated_by_user_ids",
          foreignField: "_id",
          as: "updated_by_users",
        },
      },

      // Merge user details back into updated_by array
      {
        $addFields: {
          updated_by: {
            $map: {
              input: "$safe_updated_by",
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

      // Department sort key
      {
        $addFields: {
          department_sort_name: "$department_obj.name",
        },
      },

      // Status sort key (ASC → Active first)
      {
        $addFields: {
          status_sort_value:
            sortField === "status" || sortField === "is_active"
              ? {
                $cond: {
                  if: "$is_active", // true = Active
                  then: 0, // ASC → Active first
                  else: 1, // DESC → Inactive first
                },
              }
              : null,
        },
      },

      // Main sort logic
      ...(sortField === "department"
        ? [{ $sort: { department_sort_name: sortOrder, createdAt: -1 } }]
        : [
          "name",
          "machine_number",
          "location",
          "gross_cost",
          "book_value",
          "accumulated_depreciation",
        ].includes(sortField)
          ? [{ $sort: { [sortField]: sortOrder, createdAt: -1 } }]
          : sortField === "status" || sortField === "is_active"
            ? [{ $sort: { status_sort_value: sortOrder, createdAt: -1 } }]
            : [{ $sort: { createdAt: -1 } }]),

      // Add final department object
      {
        $addFields: {
          department: "$department_obj",
        },
      },

      // Pagination
      ...(skipValue > 0 ? [{ $skip: skipValue }] : []),
      ...(limitValue > 0 ? [{ $limit: limitValue }] : []),

      // Remove intermediate fields
      {
        $unset: [
          "department_lookup",
          "department_obj",
          "department_sort_name",
          "status_sort_value",
          "safe_updated_by",
          "updated_by_user_ids",
          "updated_by_users",
        ],
      },
    ];

    const machines = await machineModel.aggregate(pipeline).collation({
      locale: "en",
      strength: 2,
    });
    //Maintenance Sorting AFTER MongoDB
    if (sortField === "maintanence") {
      machines.sort((a, b) => {
        const aKey = (a.maintanence?.[0] || "").toString().toLowerCase().trim();
        const bKey = (b.maintanence?.[0] || "").toString().toLowerCase().trim();

        if (sortOrder === 1) {
          return aKey.localeCompare(bKey);
        } else {
          return bKey.localeCompare(aKey);
        }
      });
    }

    res.status(200).json({
      success: true,
      count: machines.length,
      total: totalMachines,
      page,
      totalPages: Math.ceil(totalMachines / limitValue),
      metrics,
      data: machines,
      sortBy: sortField,
      sortOrder,
    });
  } catch (error) {
    console.error("Error getting machines:", error);
    res.status(500).json({
      success: false,
      message: "Error getting machines",
      error: error.message,
    });
  }
};

export const getMachineById = async (req, res) => {
  try {
    const { id } = req.params;
    const machine = await machineModel
      .findOne({ id })
      .populate("department")
      .populate("created_by")
      .populate("updated_by.user");

    if (!machine) {
      return res.status(404).json({
        success: false,
        message: "Machine not found",
      });
    }

    res.status(200).json({
      success: true,
      data: machine,
    });
  } catch (error) {
    console.error("Error getting machine:", error);
    res.status(500).json({
      success: false,
      message: "Error getting machine",
      error: error.message,
    });
  }
};

export const createMachine = async (req, res) => {
  try {
    const {
      name,
      machine_number,
      department,
      maintanence,
      add_fields,
      is_active,
      type,
      location,
      commission_date,
      last_service_date,
      gross_cost,
      book_value,
      accumulated_depreciation,
    } = req.body;

    if (!name || !department) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: 'name' and 'department'",
      });
    }

    const existingMachine = await machineModel.findOne({ machine_number });
    if (existingMachine) {
      return res.status(409).json({
        success: false,
        message: "Machine number already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newMachine = new machineModel({
      id: nanoid(16),
      name,
      machine_number: machine_number ?? "",
      department,
      maintanence: maintanence ?? [],
      add_fields: add_fields ?? [],
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
      type,
      location: location?.trim() ?? "",
      commission_date: commission_date ?? null,
      last_service_date: last_service_date ?? null,
      gross_cost: Number(gross_cost) || 0,
      book_value: Number(book_value) || 0,
      accumulated_depreciation: Number(accumulated_depreciation) || 0,
    });

    const savedMachine = await newMachine.save();

    res.status(201).json({
      success: true,
      message: "Machine created successfully",
      data: savedMachine,
    });
  } catch (error) {
    console.error("Error creating machine:", error);
    res.status(500).json({
      success: false,
      message: "Error creating machine",
      error: error.message,
    });
  }
};

export const updateMachine = async (req, res) => {
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

    const machine = await machineModel.findOne({ id });
    if (!machine) {
      return res.status(404).json({
        success: false,
        message: "Machine not found",
      });
    }

    if (
      updateData.machine_number &&
      updateData.machine_number !== machine.machine_number
    ) {
      const numberExists = await machineModel.findOne({
        machine_number: updateData.machine_number,
      });
      if (numberExists) {
        return res.status(409).json({
          success: false,
          message: "Machine number already in use",
        });
      }
    }

    const otherUpdates = { ...updateData };
    delete otherUpdates.updated_by;

    if (otherUpdates.gross_cost !== undefined) {
      otherUpdates.gross_cost = Number(otherUpdates.gross_cost) || 0;
    }
    if (otherUpdates.book_value !== undefined) {
      otherUpdates.book_value = Number(otherUpdates.book_value) || 0;
    }
    if (otherUpdates.accumulated_depreciation !== undefined) {
      otherUpdates.accumulated_depreciation =
        Number(otherUpdates.accumulated_depreciation) || 0;
    }

    const updatedByHistory = Array.isArray(machine.updated_by)
      ? [...machine.updated_by]
      : [];
    updatedByHistory.unshift({
      user: userId,
      date: getCurrentDate(),
    });

    await machineModel.updateOne(
      { id },
      {
        $set: {
          ...otherUpdates,
          updated_at: getCurrentDate(),
          updated_by: updatedByHistory,
        },
      }
    );

    const updatedMachine = await machineModel
      .findOne({ id })
      .populate("department")
      .populate("created_by")
      .populate("updated_by.user");

    res.status(200).json({
      success: true,
      message: "Machine updated successfully",
      data: updatedMachine,
    });
  } catch (error) {
    console.error("Error updating machine:", error);
    res.status(500).json({
      success: false,
      message: "Error updating machine",
      error: error.message,
    });
  }
};

export const deleteMachine = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedMachine = await machineModel.findOneAndDelete({ id });

    if (!deletedMachine) {
      return res.status(404).json({
        success: false,
        message: "Machine not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Machine deleted successfully",
      data: deletedMachine,
    });
  } catch (error) {
    console.error("Error deleting machine:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting machine",
      error: error.message,
    });
  }
};
