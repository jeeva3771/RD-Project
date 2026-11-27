import { nanoid } from "nanoid";
import processModel from "../../models/masters/processModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";

export const getAllProcesses = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit)))
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";
    const is_active = req.query.is_active;
    const department = req.query.department?.trim();
    const sortField = req.query.sortField?.trim();
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const query = {};

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (department) {
      query.department = { $regex: department, $options: "i" };
    }

    if (is_active !== undefined && is_active !== "" && is_active !== null) {
      if (["true", true, "1", 1].includes(is_active)) {
        query.is_active = true;
      } else if (["false", false, "0", 0].includes(is_active)) {
        query.is_active = false;
      }
    }

    let sortOption = { createdAt: -1 };

    if (sortField) {
      const isBooleanSort = sortField === "is_active";
      sortOption = {
        [sortField]: isBooleanSort ? (sortOrder === 1 ? -1 : 1) : sortOrder,
        createdAt: -1,
      };
    } else if (req.query.order) {
      const order = req.query.order === "desc" ? -1 : 1;
      sortOption = { name: order };
    }

    const totalProcesses = await processModel.countDocuments(query);

    let processQuery = processModel
      .find(query)
      .collation({ locale: "en", strength: 2 })
      .sort(sortOption)
      .populate({ path: "created_by", select: "name" })
      .populate({ path: "unit", select: "_id id name symbol" })
      .populate({ path: "linked_department", select: "_id id name" })
      .populate({ path: "updated_by.user", select: "name" })

    if (limit > 0) {
      processQuery = processQuery.skip(skip).limit(limit);
    }

    const processes = await processQuery.lean();

    const totalPages = Math.ceil(totalProcesses / limit);

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

export const getProcessById = async (req, res) => {
  try {
    const { id } = req.params;
    const process = await processModel
      .findOne({ id })
      .populate({ path: "created_by", select: "name" })
      .populate({ path: "linked_department", select: "_id id name" })
      .populate({ path: "updated_by.user", select: "name" });

    if (!process) {
      return res.status(404).json({
        success: false,
        message: "Process not found",
      });
    }

    res.status(200).json({
      success: true,
      data: process,
    });
  } catch (error) {
    console.error("Error getting process:", error);
    res.status(500).json({
      success: false,
      message: "Error getting process",
      error: error.message,
    });
  }
};


export const createProcess = async (req, res) => {
  try {
    const {
      name,
      rate,
      min_rate_slab_1,
      min_rate_slab_2,
      type,
      unit,
      department,
      linked_department,
      prompt,
      is_active,
      is_uv,
      mov,
      beds,
      is_outsource_open
    } = req.body;


    if (
      !name ||
      rate === undefined ||
      !type ||
      !unit ||
      !department
    ) {
      return res.status(400).json({
        success: false,
        message:
          "name, rate, type, unit, and department are mandatory fields",
      });
    }
    const existingProcess = await processModel.findOne({ name });
    if (existingProcess) {
      return res.status(409).json({
        success: false,
        message: "Process name already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newProcess = new processModel({
      id: nanoid(16),
      name,
      rate,
      min_rate_slab_1,
      min_rate_slab_2,
      type: type,
      unit,
      department: department,
      linked_department: linked_department || null,
      prompt: prompt || "Enter a value",
      is_active: is_active ?? true,
      is_uv: is_uv ?? false,
      mov: mov ?? 0,
      beds: beds ?? [],
      is_outsource_open: is_outsource_open ?? true,

      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
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

    if (updateData.name && updateData.name !== process.name) {
      const nameExists = await processModel.findOne({ name: updateData.name });
      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: "Process name already in use",
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

    const updatedProcess = await processModel
      .findOne({ id })
      .populate({ path: "created_by", select: "name" })
      .populate({ path: "linked_department", select: "_id id name" })
      .populate({ path: "updated_by.user", select: "name" });

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

export const deleteProcess = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedProcess = await processModel.findOneAndDelete({ id });

    if (!deletedProcess) {
      return res.status(404).json({
        success: false,
        message: "Process not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Process deleted successfully",
      data: deletedProcess,
    });
  } catch (error) {
    console.error("Error deleting process:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting process",
      error: error.message,
    });
  }
};
