import { nanoid } from "nanoid";
import deliveryTypeModel from "../../models/masters/common/deliveryTypeModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";

export const getAllDeliveryTypes = async (req, res) => {
  try {

           const query = {};

    let sortOption = { createdAt: -1 };

    if (req.query.order) {
      const sortOrder = req.query.order === "desc" ? -1 : 1;
      sortOption = { name: sortOrder };
    }
  
    

    const deliveryTypes = await deliveryTypeModel
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
      });

    res.status(200).json({
      success: true,
      count: deliveryTypes.length,
      data: deliveryTypes,
    });
  } catch (error) {
    console.error("Error getting delivery types:", error);
    res.status(500).json({
      success: false,
      message: "Error getting delivery types",
      error: error.message,
    });
  }
};

export const insertDeliveryType = async (req, res) => {
  try {
    const { name, is_active } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: name",
      });
    }

    const existingDeliveryType = await deliveryTypeModel.findOne({ name });
    if (existingDeliveryType) {
      return res.status(409).json({
        success: false,
        message: "Delivery type already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newDeliveryType = new deliveryTypeModel({
      id: nanoid(16),
      name,
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
    });

    const savedDeliveryType = await newDeliveryType.save();

    res.status(201).json({
      success: true,
      message: "Delivery type created successfully",
      data: savedDeliveryType,
    });
  } catch (error) {
    console.error("Error creating delivery type:", error);
    res.status(500).json({
      success: false,
      message: "Error creating delivery type",
      error: error.message,
    });
  }
};

export const deleteDeliveryType = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedDeliveryType = await deliveryTypeModel.findOneAndDelete({ id });

    if (!deletedDeliveryType) {
      return res.status(404).json({
        success: false,
        message: "Delivery type not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Delivery type deleted successfully",
      data: deletedDeliveryType,
    });
  } catch (error) {
    console.error("Error deleting delivery type:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting delivery type",
      error: error.message,
    });
  }
};