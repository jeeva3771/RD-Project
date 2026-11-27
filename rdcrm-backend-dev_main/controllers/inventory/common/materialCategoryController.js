import { nanoid } from "nanoid";
import materialCategoryModel from "../../../models/inventory/common/materialCategoryModel.js";
import { getCurrentDate } from "../../../helpers/dateTime.js";
import userModel from "../../../models/users/userModel.js";

// Get all material categories
export const getAllMaterialCategories = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const userExists = await userModel.exists({ _id: userId, is_active: true });
    if (!userExists) {
      return res.status(403).json({
        success: false,
        message: "User is not active or valid",
      });
    }

    const { order, page = 1, limit, search = "" } = req.query;

    // Determine sort order
    let sortOption = {};
    if (order === "asc") {
      sortOption = { name: 1 };
    } else if (order === "desc") {
      sortOption = { name: -1 };
    }

    // Build query object
    const query = { is_active: true };
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const totalCount = await materialCategoryModel.countDocuments(query);

    let categoriesQuery = materialCategoryModel
      .find(query)
      .sort(sortOption)
      .select("id name description is_active created_by created_at")
      .populate({
        path: "created_by",
        select: "name",
      })
      .populate({
        path: "updated_by",
        select: "name",
      });

    let pageNumber = 1;
    let limitNumber = totalCount || 10;

    if (limit) {
      pageNumber = parseInt(page);
      limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;
      categoriesQuery = categoriesQuery.skip(skip).limit(limitNumber);
    }

    const categories = await categoriesQuery;

    res.status(200).json({
      success: true,
      count: categories.length,
      totalCount,
      totalPages: limit ? Math.ceil(totalCount / limitNumber) : 1,
      currentPage: pageNumber,
      data: categories,
    });
  } catch (error) {
    console.error("Error getting material categories:", error);
    res.status(500).json({
      success: false,
      message: "Error getting material categories",
      error: error.message,
    });
  }
};

// Create new material category
export const createMaterialCategory = async (req, res) => {
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

    const { name, description, is_active } = req.body;
    if (!name)
      return res
        .status(400)
        .json({ success: false, message: "Missing required field: name" });

    const existing = await materialCategoryModel.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
    });
    if (existing)
      return res.status(409).json({
        success: false,
        message: "Material category name already exists",
      });

    const newCategory = new materialCategoryModel({
      id: nanoid(16),
      name,
      description,
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
    });

    const savedCategory = await newCategory.save();

    res.status(201).json({
      success: true,
      message: "Material category created successfully",
      data: savedCategory,
    });
  } catch (error) {
    console.error("Error creating material category:", error);
    res.status(500).json({
      success: false,
      message: "Error creating material category",
      error: error.message,
    });
  }
};

// Update material category
export const updateMaterialCategory = async (req, res) => {
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
    const { name, description, is_active } = req.body;

    const category = await materialCategoryModel.findOne({ id });
    if (!category)
      return res
        .status(404)
        .json({ success: false, message: "Material category not found" });

    if (name && name !== category.name) {
      const exists = await materialCategoryModel.findOne({
        name: { $regex: `^${name}$`, $options: "i" },
      });
      if (exists && exists.id !== id)
        return res.status(409).json({
          success: false,
          message: "Material category name already exists",
        });
    }

    category.name = name ?? category.name;
    category.description = description ?? category.description;
    category.is_active =
      typeof is_active === "boolean" ? is_active : category.is_active;
    category.updated_by = userId;
    category.updated_at = getCurrentDate();

    const updatedCategory = await category.save();

    res.status(200).json({
      success: true,
      message: "Material category updated successfully",
      data: updatedCategory,
    });
  } catch (error) {
    console.error("Error updating material category:", error);
    res.status(500).json({
      success: false,
      message: "Error updating material category",
      error: error.message,
    });
  }
};

// Delete material category
export const deleteMaterialCategory = async (req, res) => {
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

    const deleted = await materialCategoryModel.findOneAndDelete({ id });
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "Material category not found" });

    res.status(200).json({
      success: true,
      message: "Material category deleted successfully",
      data: deleted,
    });
  } catch (error) {
    console.error("Error deleting material category:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting material category",
      error: error.message,
    });
  }
};
