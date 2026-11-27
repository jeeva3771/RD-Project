import { nanoid } from "nanoid";
import paymentTermsModel from "../../models/masters/common/paymentTermsModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";

export const getAllPaymentTerms = async (req, res) => {
  try {

      const query = {};

    let sortOption = { createdAt: -1 };

    if (req.query.order) {
      const sortOrder = req.query.order === "desc" ? -1 : 1;
      sortOption = { name: sortOrder };
    }
  
    

    const paymentTerms = await paymentTermsModel
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
      count: paymentTerms.length,
      data: paymentTerms,
    });
  } catch (error) {
    console.error("Error getting payment terms:", error);
    res.status(500).json({
      success: false,
      message: "Error getting payment terms",
      error: error.message,
    });
  }
};

export const insertPaymentTerms = async (req, res) => {
  try {
    const { name, is_active } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: name",
      });
    }

    const existingPaymentTerms = await paymentTermsModel.findOne({ name });
    if (existingPaymentTerms) {
      return res.status(409).json({
        success: false,
        message: "Payment terms already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newPaymentTerms = new paymentTermsModel({
      id: nanoid(16),
      name,
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
    });

    const savedPaymentTerms = await newPaymentTerms.save();

    res.status(201).json({
      success: true,
      message: "Payment terms created successfully",
      data: savedPaymentTerms,
    });
  } catch (error) {
    console.error("Error creating payment terms:", error);
    res.status(500).json({
      success: false,
      message: "Error creating payment terms",
      error: error.message,
    });
  }
};

export const deletePaymentTerms = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedPaymentTerms = await paymentTermsModel.findOneAndDelete({ id });

    if (!deletedPaymentTerms) {
      return res.status(404).json({
        success: false,
        message: "Payment terms not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment terms deleted successfully",
      data: deletedPaymentTerms,
    });
  } catch (error) {
    console.error("Error deleting payment terms:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting payment terms",
      error: error.message,
    });
  }
};