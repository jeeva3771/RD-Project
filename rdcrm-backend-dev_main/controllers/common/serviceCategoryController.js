import { nanoid } from "nanoid";
import serviceCategoryModel from "../../models/masters/common/serviceCategoryModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import { escapeRegex } from "../../helpers/escapeRegex.js";

export const getAllServiceCategories = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit)));
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";
    const query = {};

    // Search filter
    if (search) {
      const safeSearch = escapeRegex(search);
      query.name = { $regex: safeSearch, $options: "i" };
    }

    // let sortOption = { createdAt: -1 };

    // if (req.query.order) {
    //   const sortOrder = req.query.order === "desc" ? -1 : 1;
    //   sortOption = { name: sortOrder };
    // }

    // DYNAMIC SORTING
    const allowedSortFields = ["name", "createdAt", "updatedAt", "is_active"];

    const sortField =
      req.query.sortBy && allowedSortFields.includes(req.query.sortBy)
        ? req.query.sortBy
        : "createdAt"; // default

    const sortorder = req.query.sortOrder === "asc" ? 1 : -1;
    // Detect if we are sorting a boolean field
    const isBooleanSort = sortField === "is_active";

    let sortOption = {};

    if (isBooleanSort) {
      // Custom boolean sort
      sortOption = {
        is_active: sortorder === 1 ? -1 : 1, // ASC → Active first
        createdAt: -1, // fallback sort
      };
    } else {
      // Normal sorting
      sortOption = {
        [sortField]: sortorder,
        createdAt: -1,
      };
    }

    if (typeof req.query.is_active !== "undefined") {
      if (req.query.is_active === "true") query.is_active = true;
      else if (req.query.is_active === "false") query.is_active = false;
    }

    const totalServices = await serviceCategoryModel.countDocuments(query);

    const services = await serviceCategoryModel
      .find(query)
      .collation({ locale: "en", strength: 2 })
      .sort(sortOption)
      .populate({
        path: "created_by",
        select: "-password -permission -created_at -updated_by -updated_at",
      })
      .populate({
        path: "updated_by.user",
        select: "-password -permission -created_at -updated_by -updated_at",
      })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalServices / limit);

    res.status(200).json({
      success: true,
      message: "Services retrieved successfully",
      count: services.length,
      total: totalServices,
      page,
      totalPages,
      data: services,
    });
  } catch (error) {
    console.error("Error getting services:", error);
    res.status(500).json({
      success: false,
      message: "Error getting services",
      error: error.message,
    });
  }
};

export const insertServiceCategory = async (req, res) => {
  try {
    const { name, is_active } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: name",
      });
    }

    const existingServiceCategory = await serviceCategoryModel.findOne({
      name,
    });
    if (existingServiceCategory) {
      return res.status(409).json({
        success: false,
        message: "Service category already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newServiceCategory = new serviceCategoryModel({
      id: nanoid(16),
      name,
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
      //  service_charge_parameter, service_cost
    });

    const savedServiceCategory = await newServiceCategory.save();

    res.status(201).json({
      success: true,
      message: "Service category created successfully",
      data: savedServiceCategory,
    });
  } catch (error) {
    console.error("Error creating service category:", error);
    res.status(500).json({
      success: false,
      message: "Error creating service category",
      error: error.message,
    });
  }
};

export const deleteServiceCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedServiceCategory = await serviceCategoryModel.findOneAndDelete({
      id,
    });

    if (!deletedServiceCategory) {
      return res.status(404).json({
        success: false,
        message: "Service category not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Service category deleted successfully",
      data: deletedServiceCategory,
    });
  } catch (error) {
    console.error("Error deleting service category:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting service category",
      error: error.message,
    });
  }
};

export const updateServiceCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user?._id;

    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: User ID not found" });

    const category = await serviceCategoryModel.findOne({ id });
    if (!category)
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });

    if (updateData.name && updateData.name !== category.name) {
      const nameExists = await serviceCategoryModel.findOne({
        name: updateData.name,
      });
      if (nameExists)
        return res
          .status(409)
          .json({ success: false, message: "Category name already in use" });
    }

    const otherUpdates = { ...updateData };
    delete otherUpdates.updated_by;

    await serviceCategoryModel.updateOne(
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

    const updatedCategory = await serviceCategoryModel.findOne({ id });
    res
      .status(200)
      .json({
        success: true,
        message: "Service category updated successfully",
        data: updatedCategory,
      });
  } catch (error) {
    console.error("Error updating service category:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Error updating service category",
        error: error.message,
      });
  }
};

export const getServiceCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await serviceCategoryModel
      .findOne({ id })
      .populate("created_by")
      .populate("updated_by.user");

    if (!category)
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });

    res.status(200).json({ success: true, data: category });
  } catch (error) {
    console.error("Error getting service category:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Error getting service category",
        error: error.message,
      });
  }
};
