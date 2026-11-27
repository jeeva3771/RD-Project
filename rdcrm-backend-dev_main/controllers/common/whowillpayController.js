import { nanoid } from "nanoid";
import WillpayModel from "../../models/masters/common/whowillpayModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";



export const getAllwillpaydataCategories = async (req, res) => {
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


    if (typeof req.query.is_active !== "undefined") {
      if (req.query.is_active === "true") query.is_active = true;
      else if (req.query.is_active === "false") query.is_active = false;
    }

    const totaldata = await WillpayModel.countDocuments(query);

    const data = await WillpayModel
      .find(query)
      .collation({ locale: "en", strength: 2 })
      .sort(sortOption)
      .populate({
        path: "created_by",
        select: "-password -permission -created_at -updated_by -updated_at"
      })
      .populate({
        path: "updated_by.user",
        select: "-password -permission -created_at -updated_by -updated_at"
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totaldata / limit);

    res.status(200).json({
      success: true,
      message: "data retrieved successfully",
      count: data.length,
      total: totaldata,
      page,
      totalPages,
      data: data,
    });
  } catch (error) {
    console.error("Error getting data:", error);
    res.status(500).json({
      success: false,
      message: "Error getting data",
      error: error.message,
    });
  }
};



export const insertwillpaydataCategory = async (req, res) => {
  try {
    const { name, is_active} = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: name",
      });
    }

    const existingwillpaydataCategory = await WillpayModel.findOne({ name });
    if (existingwillpaydataCategory) {
      return res.status(409).json({
        success: false,
        message: "willpaydata category already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newwillpaydataCategory = new WillpayModel({
      id: nanoid(16),
      name,
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
    });

    const savedwillpaydataCategory = await newwillpaydataCategory.save();

    res.status(201).json({
      success: true,
      message: "willpaydata category created successfully",
      data: savedwillpaydataCategory,
    });
  } catch (error) {
    console.error("Error creating willpaydata category:", error);
    res.status(500).json({
      success: false,
      message: "Error creating willpaydata category",
      error: error.message,
    });
  }
};

export const deletewillpaydataCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedwillpaydataCategory = await WillpayModel.findOneAndDelete({ id });

    if (!deletedwillpaydataCategory) {
      return res.status(404).json({
        success: false,
        message: "willpaydata category not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "willpaydata category deleted successfully",
      data: deletedwillpaydataCategory,
    });
  } catch (error) {
    console.error("Error deleting willpaydata category:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting willpaydata category",
      error: error.message,
    });
  }
};

export const updatewillpaydataCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user?._id;

    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized: User ID not found" });

    const category = await WillpayModel.findOne({ id });
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    if (updateData.name && updateData.name !== category.name) {
      const nameExists = await WillpayModel.findOne({ name: updateData.name });
      if (nameExists) return res.status(409).json({ success: false, message: "Category name already in use" });
    }

    const otherUpdates = { ...updateData };
    delete otherUpdates.updated_by;

    await WillpayModel.updateOne(
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

    const updatedCategory = await WillpayModel.findOne({ id });
    res.status(200).json({ success: true, message: "willpaydata category updated successfully", data: updatedCategory });
  } catch (error) {
    console.error("Error updating willpaydata category:", error);
    res.status(500).json({ success: false, message: "Error updating willpaydata category", error: error.message });
  }
};


export const getwillpaydataCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await WillpayModel.findOne({ id })
      .populate("created_by")
      .populate("updated_by.user");

    if (!category)
      return res.status(404).json({ success: false, message: "Category not found" });

    res.status(200).json({ success: true, data: category });
  } catch (error) {
    console.error("Error getting willpaydata category:", error);
    res.status(500).json({ success: false, message: "Error getting willpaydata category", error: error.message });
  }
};
