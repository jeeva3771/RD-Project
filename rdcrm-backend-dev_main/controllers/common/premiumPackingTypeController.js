import { nanoid } from "nanoid";
import premiumPackingTypeModel from "../../models/masters/common/premiumPackingTypeModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";

export const getAllPremiumPackingTypes = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit)));
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";

    const query = {};

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

      let sortOption = { createdAt: -1 };

    if (req.query.order) {
      const sortOrder = req.query.order === "desc" ? -1 : 1;
      sortOption = { name: sortOrder };
    }
  

    const totalPremiumPackingTypes = await premiumPackingTypeModel.countDocuments(query);

    const premiumPackingTypes = await premiumPackingTypeModel
      .find(query)
      .collation({ locale: "en", strength: 2 })
      .sort(sortOption)
      .select('id name is_active created_by')
      .populate({
        path: 'created_by',
        select: '-password -permission -created_at -updated_by -updated_at'
      })
      .populate({
        path: 'updated_by.user',
        select: '-password -permission -created_at -updated_by -updated_at'
      })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalPremiumPackingTypes / limit);

    res.status(200).json({
      success: true,
      count: premiumPackingTypes.length,
      total: totalPremiumPackingTypes,
      page,
      totalPages,
      data: premiumPackingTypes,
    });
  } catch (error) {
    console.error("Error getting premium packing types:", error);
    res.status(500).json({
      success: false,
      message: "Error getting premium packing types",
      error: error.message,
    });
  }
};

export const getPremiumPackingTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    const premiumPackingType = await premiumPackingTypeModel
      .findOne({ id })
      .select('id name is_active created_by')
      .populate({
        path: 'created_by',
        select: '-password -permission -created_at -updated_by -updated_at'
      })
      .populate({
        path: 'updated_by.user',
        select: '-password -permission -created_at -updated_by -updated_at'
      });

    if (!premiumPackingType) {
      return res.status(404).json({
        success: false,
        message: "Premium packing type not found",
      });
    }

    res.status(200).json({
      success: true,
      data: premiumPackingType,
    });
  } catch (error) {
    console.error("Error getting premium packing type:", error);
    res.status(500).json({
      success: false,
      message: "Error getting premium packing type",
      error: error.message,
    });
  }
};

export const createPremiumPackingType = async (req, res) => {
  try {
    const { name, is_active } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    const existingPremiumPackingType = await premiumPackingTypeModel.findOne({ name });
    if (existingPremiumPackingType) {
      return res.status(409).json({
        success: false,
        message: "Premium packing type name already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newPremiumPackingType = new premiumPackingTypeModel({
      id: nanoid(16),
      name,
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
    });

    const savedPremiumPackingType = await newPremiumPackingType.save();

    res.status(201).json({
      success: true,
      message: "Premium packing type created successfully",
      data: savedPremiumPackingType,
    });
  } catch (error) {
    console.error("Error creating premium packing type:", error);
    res.status(500).json({
      success: false,
      message: "Error creating premium packing type",
      error: error.message,
    });
  }
};

export const updatePremiumPackingType = async (req, res) => {
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

    const premiumPackingType = await premiumPackingTypeModel.findOne({ id });
    if (!premiumPackingType) {
      return res.status(404).json({
        success: false,
        message: "Premium packing type not found",
      });
    }

    if (updateData.name && updateData.name !== premiumPackingType.name) {
      const nameExists = await premiumPackingTypeModel.findOne({ name: updateData.name });
      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: "Premium packing type name already in use",
        });
      }
    }

    const otherUpdates = { ...updateData };
    delete otherUpdates.updated_by;

    await premiumPackingTypeModel.updateOne(
      { id },
      {
        $set: {
          ...otherUpdates,
          updated_at: getCurrentDate(),
        },
        $push: {
          updated_by: {
            user: userId,
            date: getCurrentDate(),
          },
        },
      }
    );

    const updatedPremiumPackingType = await premiumPackingTypeModel
      .findOne({ id })
      .select('id name is_active created_by')
      .populate({
        path: 'created_by',
        select: '-password -permission -created_at -updated_by -updated_at'
      })
      .populate({
        path: 'updated_by.user',
        select: '-password -permission -created_at -updated_by -updated_at'
      });

    res.status(200).json({
      success: true,
      message: "Premium packing type updated successfully",
      data: updatedPremiumPackingType,
    });
  } catch (error) {
    console.error("Error updating premium packing type:", error);
    res.status(500).json({
      success: false,
      message: "Error updating premium packing type",
      error: error.message,
    });
  }
};

export const deletePremiumPackingType = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedPremiumPackingType = await premiumPackingTypeModel.findOneAndDelete({ id });

    if (!deletedPremiumPackingType) {
      return res.status(404).json({
        success: false,
        message: "Premium packing type not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Premium packing type deleted successfully",
      data: deletedPremiumPackingType,
    });
  } catch (error) {
    console.error("Error deleting premium packing type:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting premium packing type",
      error: error.message,
    });
  }
};