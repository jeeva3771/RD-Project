import { nanoid } from "nanoid";
import ControlTowerDept from "../../models/controltower/controlTowerModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import { escapeRegex } from "../../helpers/escapeRegex.js";

// GET all control tower departments
export const getAllControlTowerDepts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 100));
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";
    const query = {};

    if (search) {
      const safeSearch = escapeRegex(search);
      query.name = { $regex: safeSearch, $options: "i" };
    }

    if (typeof req.query.is_active !== "undefined") {
      if (req.query.is_active === "true") query.is_active = true;
      else if (req.query.is_active === "false") query.is_active = false;
    }

    const total = await ControlTowerDept.countDocuments(query);

    const depts = await ControlTowerDept.find(query)
      .populate("processes", "id name department type")
      .populate("primary_variable", "id name symbol")
      .populate("supervisors", "id name")
      .populate("operators", "id name")
      .populate("created_by", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      count: depts.length,
      total,
      page,
      totalPages,
      data: depts,
    });
  } catch (error) {
    console.error("Error getting control tower depts:", error);
    res.status(500).json({
      success: false,
      message: "Error getting control tower departments",
      error: error.message,
    });
  }
};

// GET single control tower department by ID
export const getControlTowerDeptById = async (req, res) => {
  try {
    const { id } = req.params;
    const dept = await ControlTowerDept.findOne({ id })
      .populate("processes", "id name department type")
      .populate("primary_variable", "id name symbol")
      .populate("supervisors", "id name")
      .populate("operators", "id name")
      .populate("created_by", "name email");

    if (!dept) {
      return res.status(404).json({ success: false, message: "Control tower department not found" });
    }

    res.status(200).json({ success: true, data: dept });
  } catch (error) {
    console.error("Error getting control tower dept:", error);
    res.status(500).json({ success: false, message: "Error getting control tower department", error: error.message });
  }
};

// CREATE a new control tower department
export const createControlTowerDept = async (req, res) => {
  try {
    const {
      name,
      icon,
      accent,
      pattern,
      processes,
      primary_variable,
      machines,
      sub_stages,
      supervisors,
      operators,
      is_active,
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Floor name is required" });
    }

    const trimmedName = name.trim().toUpperCase();
    const isDefaultName = ['LASER CUTTING STUDIO', 'UV PRINTING STUDIO', 'DTP PRE-PRESS', 'ASSEMBLY BAY'].includes(trimmedName) ||
      trimmedName.startsWith('LASER') || trimmedName.startsWith('UV') || trimmedName === 'DTP' || trimmedName === 'DTP PRE-PRESS' || trimmedName.startsWith('ASSEMBLY');
    if (isDefaultName) {
      return res.status(400).json({ success: false, message: "Floor name already exists" });
    }

    const existing = await ControlTowerDept.findOne({ name: { $regex: new RegExp(`^${escapeRegex(name.trim())}$`, 'i') } });
    if (existing) {
      return res.status(400).json({ success: false, message: "Floor name already exists" });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: User ID not found" });
    }

    const resolvedPattern = pattern || "A";
    const resolvedSubStages = resolvedPattern === "A" ? [] : (sub_stages || []);

    const newDept = new ControlTowerDept({
      id: nanoid(16),
      name,
      icon: icon || "🖥️",
      accent: accent || "#0D9488",
      pattern: resolvedPattern,
      processes: processes || [],
      primary_variable: primary_variable || null,
      machines: machines || [],
      sub_stages: resolvedSubStages,
      supervisors: supervisors || [],
      operators: operators || [],
      is_active: is_active !== undefined ? is_active : true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
    });

    const saved = await newDept.save();

    // Re-fetch with populated refs
    const populated = await ControlTowerDept.findById(saved._id)
      .populate("processes", "id name department type")
      .populate("primary_variable", "id name symbol")
      .populate("supervisors", "id name")
      .populate("operators", "id name")
      .populate("created_by", "name email");

    res.status(201).json({
      success: true,
      message: "Control tower department created successfully",
      data: populated,
    });
  } catch (error) {
    console.error("Error creating control tower dept:", error);
    res.status(500).json({ success: false, message: "Error creating control tower department", error: error.message });
  }
};

// UPDATE a control tower department
export const updateControlTowerDept = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: User ID not found" });
    }

    const dept = await ControlTowerDept.findOne({ id });
    if (!dept) {
      return res.status(404).json({ success: false, message: "Control tower department not found" });
    }

    if (updateData.name) {
      const trimmedName = updateData.name.trim().toUpperCase();
      const isDefaultName = ['LASER CUTTING STUDIO', 'UV PRINTING STUDIO', 'DTP PRE-PRESS', 'ASSEMBLY BAY'].includes(trimmedName) ||
        trimmedName.startsWith('LASER') || trimmedName.startsWith('UV') || trimmedName === 'DTP' || trimmedName === 'DTP PRE-PRESS' || trimmedName.startsWith('ASSEMBLY');
      if (isDefaultName) {
        return res.status(400).json({ success: false, message: "floorname already exists" });
      }

      const existing = await ControlTowerDept.findOne({
        id: { $ne: id },
        name: { $regex: new RegExp(`^${escapeRegex(updateData.name.trim())}$`, 'i') }
      });
      if (existing) {
        return res.status(400).json({ success: false, message: "floorname already exists" });
      }
    }

    const otherUpdates = { ...updateData };
    delete otherUpdates.updated_by;

    const currentPattern = otherUpdates.pattern !== undefined ? otherUpdates.pattern : dept.pattern;
    if (currentPattern === "A") {
      otherUpdates.sub_stages = [];
    }

    await ControlTowerDept.updateOne(
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

    const updatedDept = await ControlTowerDept.findOne({ id })
      .populate("processes", "id name department type")
      .populate("primary_variable", "id name symbol")
      .populate("supervisors", "id name")
      .populate("operators", "id name")
      .populate("created_by", "name email");

    res.status(200).json({
      success: true,
      message: "Control tower department updated successfully",
      data: updatedDept,
    });
  } catch (error) {
    console.error("Error updating control tower dept:", error);
    res.status(500).json({ success: false, message: "Error updating control tower department", error: error.message });
  }
};

// DELETE a control tower department
export const deleteControlTowerDept = async (req, res) => {
  try {
    const { id } = req.params;

    const dept = await ControlTowerDept.findOne({ id });
    if (!dept) {
      return res.status(404).json({ success: false, message: "Control tower department not found" });
    }

    const uName = (dept.name || '').toUpperCase();
    if (uName.includes('LASER') || uName.includes('UV') || uName.includes('DTP') || uName.includes('ASSEMBLY')) {
      return res.status(400).json({ success: false, message: "Default/System shop floors cannot be deleted" });
    }

    await ControlTowerDept.findOneAndDelete({ id });

    res.status(200).json({
      success: true,
      message: "Control tower department deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting control tower dept:", error);
    res.status(500).json({ success: false, message: "Error deleting control tower department", error: error.message });
  }
};
