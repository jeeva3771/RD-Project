import { nanoid } from "nanoid";
import materialTypeModel from "../../../models/inventory/common/materialTypeModel.js";
import { getCurrentDate } from "../../../helpers/dateTime.js";
import userModel from "../../../models/users/userModel.js";

// Get all material types
export const getAllMaterialTypes = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const userExists = await userModel.exists({
      _id: userId,
      is_active: true,
    });

    if (!userExists) {
      return res.status(403).json({
        success: false,
        message: "User is not active or valid",
      });
    }

    const { order, page = 1, limit, search = "" } = req.query;

    let sortOption = {};
    if (order === "asc") {
      sortOption = { name: 1 };
    } else if (order === "desc") {
      sortOption = { name: -1 };
    }

    const query = { is_active: true };
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const totalCount = await materialTypeModel.countDocuments(query);

    let materialsQuery = materialTypeModel
      .find(query)
      .sort(sortOption)
      .select("id name is_active created_by created_at")
      .populate({
        path: "created_by",
        select: "name",
      })
      .populate({
        path: "updated_by",
        select: "name",
      });

    let pageNumber = 1;
    let limitNumber = totalCount || 10; // Default to totalCount if no limit, effectively showing all

    if (limit) {
      pageNumber = parseInt(page);
      limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;
      materialsQuery = materialsQuery.skip(skip).limit(limitNumber);
    }

    const materials = await materialsQuery;

    res.status(200).json({
      success: true,
      count: materials.length,
      totalCount,
      totalPages: limit ? Math.ceil(totalCount / limitNumber) : 1,
      currentPage: pageNumber,
      data: materials,
    });
  } catch (error) {
    console.error("Error getting material types:", error);
    res.status(500).json({
      success: false,
      message: "Error getting material types",
      error: error.message,
    });
  }
};


// Insert new material type
export const createMaterialType = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: User ID not found" });

    const userExists = await userModel.exists({ _id: userId, is_active: true });
    if (!userExists)
      return res
        .status(403)
        .json({ success: false, message: "User is not active or valid" });

    const { name, is_active } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: name",
      });
    }

    const existingMaterial = await materialTypeModel.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
    });
    if (existingMaterial) {
      return res.status(409).json({
        success: false,
        message: "Material type name already exists",
      });
    }

    const newMaterial = new materialTypeModel({
      id: nanoid(16),
      name,
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
    });

    const savedMaterial = await newMaterial.save();

    res.status(201).json({
      success: true,
      message: "Material type created successfully",
      data: savedMaterial,
    });
  } catch (error) {
    console.error("Error creating material type:", error);
    res.status(500).json({
      success: false,
      message: "Error creating material type",
      error: error.message,
    });
  }
};

// Update material type
export const updateMaterialType = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: User ID not found" });

    const userExists = await userModel.exists({ _id: userId, is_active: true });
    if (!userExists)
      return res
        .status(403)
        .json({ success: false, message: "User is not active or valid" });

    const { id } = req.params;
    const { name, is_active } = req.body;

    const material = await materialTypeModel.findOne({ id });
    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material type not found",
      });
    }

    if (name && name !== material.name) {
      const existing = await materialTypeModel.findOne({
        name: { $regex: `^${name}$`, $options: "i" },
      });
      if (existing && existing.id !== id) {
        return res.status(409).json({
          success: false,
          message: "Material type name already exists",
        });
      }
    }

    material.name = name ?? material.name;
    material.is_active =
      typeof is_active === "boolean" ? is_active : material.is_active;
    material.updated_by = userId;
    material.updated_at = getCurrentDate();

    const updatedMaterial = await material.save();

    res.status(200).json({
      success: true,
      message: "Material type updated successfully",
      data: updatedMaterial,
    });
  } catch (error) {
    console.error("Error updating material type:", error);
    res.status(500).json({
      success: false,
      message: "Error updating material type",
      error: error.message,
    });
  }
};

// Delete material type
export const deleteMaterialType = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: User ID not found" });

    const userExists = await userModel.exists({ _id: userId, is_active: true });
    if (!userExists)
      return res
        .status(403)
        .json({ success: false, message: "User is not active or valid" });

    const { id } = req.params;
    const deletedMaterial = await materialTypeModel.findOneAndDelete({ id });

    if (!deletedMaterial) {
      return res.status(404).json({
        success: false,
        message: "Material type not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Material type deleted successfully",
      data: deletedMaterial,
    });
  } catch (error) {
    console.error("Error deleting material type:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting material type",
      error: error.message,
    });
  }
};
