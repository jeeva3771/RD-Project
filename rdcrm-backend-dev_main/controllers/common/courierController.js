import { nanoid } from "nanoid";
import courierModel from "../../models/masters/common/courierModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";

export const getAllCouriers = async (req, res) => {
  try {

       const query = {};

    let sortOption = { createdAt: -1 };

    if (req.query.order) {
      const sortOrder = req.query.order === "desc" ? -1 : 1;
      sortOption = { name: sortOrder };
    }
  
    


    const couriers = await courierModel
       .find(query)
      .collation({ locale: "en", strength: 2 })
      .sort(sortOption)
      .select('id name is_active created_by') 
      .sort(sortOption)
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
      count: couriers.length,
      data: couriers,
    });
  } catch (error) {
    console.error("Error getting couriers:", error);
    res.status(500).json({
      success: false,
      message: "Error getting couriers",
      error: error.message,
    });
  }
};

export const insertCourier = async (req, res) => {
  try {
    const { name, is_active } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: name",
      });
    }

    const existingCourier = await courierModel.findOne({ name });
    if (existingCourier) {
      return res.status(409).json({
        success: false,
        message: "Courier already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newCourier = new courierModel({
      id: nanoid(16),
      name,
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
    });

    const savedCourier = await newCourier.save();

    res.status(201).json({
      success: true,
      message: "Courier created successfully",
      data: savedCourier,
    });
  } catch (error) {
    console.error("Error creating courier:", error);
    res.status(500).json({
      success: false,
      message: "Error creating courier",
      error: error.message,
    });
  }
};

export const deleteCourier = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedCourier = await courierModel.findOneAndDelete({ id });

    if (!deletedCourier) {
      return res.status(404).json({
        success: false,
        message: "Courier not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Courier deleted successfully",
      data: deletedCourier,
    });
  } catch (error) {
    console.error("Error deleting courier:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting courier",
      error: error.message,
    });
  }
};