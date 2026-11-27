import { nanoid } from "nanoid";
import deliveryModeModel from "../../models/masters/common/deliveryModeModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";

export const getAllDeliverymode = async (req, res) => {
  try {

      const query = {};

    let sortOption = { createdAt: -1 };

    if (req.query.order) {
      const sortOrder = req.query.order === "desc" ? -1 : 1;
      sortOption = { name: sortOrder };
    }
  

    const deliverymode = await deliveryModeModel
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
      count: deliverymode.length,
      data: deliverymode,
    });
  } catch (error) {
    console.error("Error getting delivery mode:", error);
    res.status(500).json({
      success: false,
      message: "Error getting delivery mode",
      error: error.message,
    });
  }
};

export const insertDeliverymode = async (req, res) => {
  try {
    const { name, is_active } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: name",
      });
    }

    const existingDeliverymode = await deliveryModeModel.findOne({ name });
    if (existingDeliverymode) {
      return res.status(409).json({
        success: false,
        message: "Delivery mode already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newDeliverymode = new deliveryModeModel({
      id: nanoid(16),
      name,
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
    });

    const savedDeliverymode = await newDeliverymode.save();

    res.status(201).json({
      success: true,
      message: "Delivery mode created successfully",
      data: savedDeliverymode,
    });
  } catch (error) {
    console.error("Error creating delivery mode:", error);
    res.status(500).json({
      success: false,
      message: "Error creating delivery mode",
      error: error.message,
    });
  }
};

export const deleteDeliverymode = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedDeliverymode = await deliveryModeModel.findOneAndDelete({ id });

    if (!deletedDeliverymode) {
      return res.status(404).json({
        success: false,
        message: "Delivery mode not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Delivery mode deleted successfully",
      data: deletedDeliverymode,
    });
  } catch (error) {
    console.error("Error deleting delivery mode:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting delivery mode",
      error: error.message,
    });
  }
};