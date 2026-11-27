import workModel from "../../models/masters/workModel.js";

// Create Work
export const createWork = async (req, res) => {
  try {
    const { work_name, is_active } = req.body;

    if (!work_name) {
      return res.status(400).json({ success: false, message: "Work Name is required" });
    }

    const existingWork = await workModel.findOne({
      work_name: { $regex: new RegExp(`^${work_name}$`, "i") },
    });

    if (existingWork) {
      return res.status(400).json({ success: false, message: "Work Name already exists" });
    }

    const work = new workModel({
      work_name,
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user?._id,
    });

    await work.save();
    res.status(201).json({ success: true, message: "Work created successfully", data: work });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get All Works
export const getAllWorks = async (req, res) => {
  try {
    const { search, is_active } = req.query;
    let query = {};

    if (search) {
      query.work_name = { $regex: search, $options: "i" };
    }

    if (is_active === "true") {
      query.is_active = true;
    } else if (is_active === "false") {
      query.is_active = false;
    }

    const page = Math.max(1, parseInt(req.query.page));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit)));
    const skip = (page - 1) * limit;

    const sortKey = req.query.sortKey || "createdAt";
    let sortDir = req.query.sortDir === "asc" ? 1 : -1;
    
    // Make Active (true/2) come first when sorted ascending
    if (sortKey === "is_active") {
      sortDir = sortDir === 1 ? -1 : 1;
    }

    const works = await workModel
      .find(query)
      .populate("created_by", "name")
      .populate("updated_by", "name")
      .sort({ [sortKey]: sortDir })
      .skip(skip)
      .limit(limit);

    const total = await workModel.countDocuments(query);

    res.status(200).json({
      success: true,
      data: works,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalCount: total,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Work by ID
export const getWorkById = async (req, res) => {
  try {
    const { id } = req.params;
    const work = await workModel.findById(id);

    if (!work) {
      return res.status(404).json({ success: false, message: "Work not found" });
    }

    res.status(200).json({ success: true, data: work });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Work
export const updateWork = async (req, res) => {
  try {
    const { id } = req.params;
    const { work_name, is_active } = req.body;

    const existingWork = await workModel.findOne({
      work_name: { $regex: new RegExp(`^${work_name}$`, "i") },
      _id: { $ne: id },
    });

    if (existingWork) {
      return res.status(400).json({ success: false, message: "Work Name already exists" });
    }

    const work = await workModel.findByIdAndUpdate(
      id,
      {
        work_name,
        is_active,
        updated_by: req.user?._id,
      },
      { new: true }
    );

    if (!work) {
      return res.status(404).json({ success: false, message: "Work not found" });
    }

    res.status(200).json({ success: true, message: "Work updated successfully", data: work });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Work
export const deleteWork = async (req, res) => {
  try {
    const { id } = req.params;
    const work = await workModel.findByIdAndDelete(id);

    if (!work) {
      return res.status(404).json({ success: false, message: "Work not found" });
    }

    res.status(200).json({ success: true, message: "Work deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
