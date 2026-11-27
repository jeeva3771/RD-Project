import { nanoid } from "nanoid";
import packingModeModel from "../../models/masters/common/packingModeModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";

export const getAllPackingModes = async (req, res) => {
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
  

    const totalPackingModes = await packingModeModel.countDocuments(query);

    const packingModes = await packingModeModel
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

    const totalPages = Math.ceil(totalPackingModes / limit);

    res.status(200).json({
      success: true,
      count: packingModes.length,
      total: totalPackingModes,
      page,
      totalPages,
      data: packingModes,
    });
  } catch (error) {
    console.error("Error getting packing modes:", error);
    res.status(500).json({
      success: false,
      message: "Error getting packing modes",
      error: error.message,
    });
  }
};

export const getPackingModeById = async (req, res) => {
  try {
    const { id } = req.params;
    const packingMode = await packingModeModel
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

    if (!packingMode) {
      return res.status(404).json({
        success: false,
        message: "Packing mode not found",
      });
    }

    res.status(200).json({
      success: true,
      data: packingMode,
    });
  } catch (error) {
    console.error("Error getting packing mode:", error);
    res.status(500).json({
      success: false,
      message: "Error getting packing mode",
      error: error.message,
    });
  }
};

export const createPackingMode = async (req, res) => {
  try {
    const { name, is_active } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    const existingPackingMode = await packingModeModel.findOne({ name });
    if (existingPackingMode) {
      return res.status(409).json({
        success: false,
        message: "Packing mode name already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newPackingMode = new packingModeModel({
      id: nanoid(16),
      name,
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
    });

    const savedPackingMode = await newPackingMode.save();

    res.status(201).json({
      success: true,
      message: "Packing mode created successfully",
      data: savedPackingMode,
    });
  } catch (error) {
    console.error("Error creating packing mode:", error);
    res.status(500).json({
      success: false,
      message: "Error creating packing mode",
      error: error.message,
    });
  }
};

export const updatePackingMode = async (req, res) => {
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

    const packingMode = await packingModeModel.findOne({ id });
    if (!packingMode) {
      return res.status(404).json({
        success: false,
        message: "Packing mode not found",
      });
    }

    if (updateData.name && updateData.name !== packingMode.name) {
      const nameExists = await packingModeModel.findOne({ name: updateData.name });
      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: "Packing mode name already in use",
        });
      }
    }

    const otherUpdates = { ...updateData };
    delete otherUpdates.updated_by;

    await packingModeModel.updateOne(
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

    const updatedPackingMode = await packingModeModel
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
      message: "Packing mode updated successfully",
      data: updatedPackingMode,
    });
  } catch (error) {
    console.error("Error updating packing mode:", error);
    res.status(500).json({
      success: false,
      message: "Error updating packing mode",
      error: error.message,
    });
  }
};

export const deletePackingMode = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedPackingMode = await packingModeModel.findOneAndDelete({ id });

    if (!deletedPackingMode) {
      return res.status(404).json({
        success: false,
        message: "Packing mode not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Packing mode deleted successfully",
      data: deletedPackingMode,
    });
  } catch (error) {
    console.error("Error deleting packing mode:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting packing mode",
      error: error.message,
    });
  }
};