import { nanoid } from "nanoid";
import departmentModel from "../../models/masters/departmentModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import machineModel from "../../models/masters/machineModel.js";
import userModel from "../../models/users/userModel.js";
import processModel from "../../models/masters/processModel.js";

export const getAllDepartments = async (req, res) => {
  try {
    console.log("REQ QUERY:", req.query);
    const page = Math.max(1, parseInt(req.query.page));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit)));
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";
    const is_active = req.query.is_active;
    const type = req.query.type?.trim() || "";
    const sortField = req.query.sortField?.trim();
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    let query = {};

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    // Handle type filter
    if (type) {
      query.type = type;
    }

    // FIXED is_active HANDLING
    if (is_active !== undefined && is_active !== "" && is_active !== null) {
      if (["true", true, "1", 1].includes(is_active)) {
        query.is_active = true;
      } else if (["false", false, "0", 0].includes(is_active)) {
        query.is_active = false;
      }
    }

    console.log("FINAL QUERY:", query);
    const totalDepartments = await departmentModel.countDocuments(query);
    const totalPages = Math.ceil(totalDepartments / limit);

    // Detect if we are sorting a boolean field
    const isBooleanSort = sortField === "is_active";

    const pipeline = [
      { $match: query },

      // JOIN created_by user
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

      // Lookup updated_by user details
      {
        $lookup: {
          from: "users",
          localField: "updated_by_user_ids",
          foreignField: "_id",
          as: "updated_by_user_data",
        },
      },

      // Merge updated_by user details back
      {
        $addFields: {
          updated_by: {
            $map: {
              input: "$updated_by",
              as: "row",
              in: {
                user: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$updated_by_user_data",
                        as: "usr",
                        cond: { $eq: ["$$usr._id", "$$row.user"] },
                      },
                    },
                    0,
                  ],
                },
                date: "$$row.date",
              },
            },
          },
        },
      },

      // Sorting
      sortField
        ? {
            $sort: {
              // flip ASC/DESC ONLY for boolean
              [sortField]: isBooleanSort
                ? sortOrder === 1
                  ? -1
                  : 1 // active first on ASC
                : sortOrder, // normal sorting for strings/numbers

              createdAt: -1, // secondary sort
            },
          }
        : { $sort: { createdAt: -1 } },

        // Remove temporary fields
      { $unset: ["updated_by_user_ids", "updated_by_user_data"] },
    ];

    if (limit) {
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });
    }

    console.log("PIPELINE:", JSON.stringify(pipeline));
    const departments = await departmentModel
      .aggregate(pipeline)
      .collation({ locale: "en", strength: 2 });

    const process_pipeline = [
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

      
    ];

    const allProcesses = await processModel
      .aggregate(process_pipeline)
      .collation({ locale: "en", strength: 2 });
    // const allProcesses = await processModel.find({}, "name department").lean();
    const departmentsWithProcesses = departments.map((dept) => {
      const linked = allProcesses
        .filter((p) => {
          if (!p.department) return false;

          // If department is an array
          if (Array.isArray(p.department)) {
            return p.department.some(
              (d) => d.toString() === dept._id.toString()
            );
          }

          // If department is a single ObjectId
          return p.department.toString() === dept._id.toString();
        })
        .map((p) => p.service_category?.name)
        .filter(Boolean); // remove undefined

      return {
        ...dept,
        under_process: linked,
      };
    });

    res.status(200).json({
      success: true,
      count: departmentsWithProcesses.length,
      total: totalDepartments,
      page,
      totalPages,
      data: departmentsWithProcesses,
    });
  } catch (error) {
    console.error("Error getting departments:", error);
    res.status(500).json({
      success: false,
      message: "Error getting departments",
      error: error.message,
    });
  }
};

export const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const department = await departmentModel
      .findOne({ id })
      // .populate("under_process")
      .populate("created_by")
      .populate("updated_by.user");

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    res.status(200).json({
      success: true,
      data: department,
    });
  } catch (error) {
    console.error("Error getting department:", error);
    res.status(500).json({
      success: false,
      message: "Error getting department",
      error: error.message,
    });
  }
};

export const createDepartment = async (req, res) => {
  try {
    const { name, is_active, type } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields or invalid 'Name'",
      });
    }

    const existingDepartment = await departmentModel.findOne({ name });
    if (existingDepartment) {
      return res.status(409).json({
        success: false,
        message: "Department name already exists",
      });
    }

    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newDepartment = new departmentModel({
      id: nanoid(16),
      name,
      // under_process,
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
      type,
    });

    const savedDepartment = await newDepartment.save();

    res.status(201).json({
      success: true,
      message: "Department created successfully",
      data: savedDepartment,
    });
  } catch (error) {
    console.error("Error creating department:", error);
    res.status(500).json({
      success: false,
      message: "Error creating department",
      error: error.message,
    });
  }
};

export const updateDepartment = async (req, res) => {
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

    const department = await departmentModel.findOne({ id });
    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    if (updateData.name && updateData.name !== department.name) {
      const nameExists = await departmentModel.findOne({
        name: updateData.name,
      });
      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: "Department name already in use",
        });
      }
    }

    const otherUpdates = { ...updateData };
    delete otherUpdates.updated_by;

    await departmentModel.updateOne(
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
        // $push: {
        //   updated_by: {
        //     user: userId,
        //     date: getCurrentDate(),
        //   },
        // },
      }
    );

    const updatedDepartment = await departmentModel
      .findOne({ id })
      // .populate("under_process")
      .populate("created_by")
      .populate("updated_by.user");

    res.status(200).json({
      success: true,
      message: "Department updated successfully",
      data: updatedDepartment,
    });
  } catch (error) {
    console.error("Error updating department:", error);
    res.status(500).json({
      success: false,
      message: "Error updating department",
      error: error.message,
    });
  }
};

export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const departmentToDelete = await departmentModel.findOne({ id });

    if (!departmentToDelete) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    const isDepartmentLinkedWithProcess = await processModel.findOne({
      department: departmentToDelete._id,
    });

    if (isDepartmentLinkedWithProcess) {
      return res.status(400).json({
        success: false,
        message:
          "Department cannot be deleted because it is linked with one or more processes.",
      });
    }

    const isDepartmentInUse = await machineModel.findOne({
      department: departmentToDelete._id,
    });

    const isDepartmentInUseUser = await userModel.findOne({
      department_id: departmentToDelete._id,
    });

    if (isDepartmentInUse && isDepartmentInUseUser) {
      return res.status(400).json({
        success: false,
        message:
          "Department cannot be deleted because it is in use by both machines and users.",
      });
    }

    if (isDepartmentInUse) {
      return res.status(400).json({
        success: false,
        message:
          "Department cannot be deleted because it is in use by a machine.",
      });
    }

    if (isDepartmentInUseUser) {
      return res.status(400).json({
        success: false,
        message: "Department cannot be deleted because it is in use by a user.",
      });
    }

    const deletedDepartment = await departmentModel.findOneAndDelete({ id });

    if (!deletedDepartment) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Department deleted successfully",
      data: deletedDepartment,
    });
  } catch (error) {
    console.error("Error deleting department:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting department",
      error: error.message,
    });
  }
};
