import { nanoid } from "nanoid";
import packingTypeModel from "../../models/masters/common/packingTypeModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";

export const getAllPackingTypes = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page));
    const limit = req.query.limit
      ? Math.min(100, Math.max(1, parseInt(req.query.limit)))
      : 10;

    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";

      const is_active = req.query.is_active;

    const sortField = req.query.sortField?.trim();
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const query = {};
    
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

          if (is_active !== undefined && is_active !== "" && is_active !== null) {
        if (["true", true, "1", 1].includes(is_active)) {
          query.is_active = true;
        } else if (["false", false, "0", 0].includes(is_active)) {
          query.is_active = false;
        }
      }

    let sortOption = { createdAt: -1 };


    if (sortField) {
      const isBooleanSort = sortField === "is_active";

      sortOption = {
        [sortField]: isBooleanSort
          ? sortOrder === 1
            ? -1 // active first on ASC
            : 1
          : sortOrder,
        createdAt: -1,
      };
    }
    else if (req.query.order) {
      const order = req.query.order === "desc" ? -1 : 1;
      sortOption = { name: order };
    }

    const totalPackingTypes = await packingTypeModel.countDocuments(query);

    const packingTypes = await packingTypeModel
      .find(query)
      .collation({ locale: "en", strength: 2 })
      .sort(sortOption)
      .select("id name is_active created_by updated_by created_at updated_at")
      .populate({
        path: "created_by",
        select: "name",
      })
      .populate({
        path: "updated_by.user",
        select: "name",
      })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalPackingTypes / limit);

    res.status(200).json({
      success: true,
      count: packingTypes.length,
      total: totalPackingTypes,
      page,
      totalPages,
      data: packingTypes,
    });
  } catch (error) {
    console.error("Error getting packing types:", error);
    res.status(500).json({
      success: false,
      message: "Error getting packing types",
      error: error.message,
    });
  }
};


export const getPackingTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    const packingType = await packingTypeModel
      .findOne({ id })
      .select('id name is_active created_by')
      // .populate({
      //   path: 'created_by',
      //   select: '-password -permission -created_at -updated_by -updated_at'
      // })
      // .populate({
      //   path: 'updated_by.user',
      //   select: '-password -permission -created_at -updated_by -updated_at'
      // });

    if (!packingType) {
      return res.status(404).json({
        success: false,
        message: "Packing type not found",
      });
    }

    res.status(200).json({
      success: true,
      data: packingType,
    });
  } catch (error) {
    console.error("Error getting packing type:", error);
    res.status(500).json({
      success: false,
      message: "Error getting packing type",
      error: error.message,
    });
  }
};

export const createPackingType = async (req, res) => {
  try {
    const { name, is_active } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    const existingPackingType = await packingTypeModel.findOne({ name });
    if (existingPackingType) {
      return res.status(409).json({
        success: false,
        message: "Packing type name already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newPackingType = new packingTypeModel({
      id: nanoid(16),
      name,
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
    });

    const savedPackingType = await newPackingType.save();

    res.status(201).json({
      success: true,
      message: "Packing type created successfully",
      data: savedPackingType,
    });
  } catch (error) {
    console.error("Error creating packing type:", error);
    res.status(500).json({
      success: false,
      message: "Error creating packing type",
      error: error.message,
    });
  }
};

export const updatePackingType = async (req, res) => {
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

    const packingType = await packingTypeModel.findOne({ id });
    if (!packingType) {
      return res.status(404).json({
        success: false,
        message: "Packing type not found",
      });
    }

    if (updateData.name && updateData.name !== packingType.name) {
      const nameExists = await packingTypeModel.findOne({ name: updateData.name });
      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: "Packing type name already in use",
        });
      }
    }

    const otherUpdates = { ...updateData };
    delete otherUpdates.updated_by;

    await packingTypeModel.updateOne(
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
        // $push: {
        //   updated_by: {
        //     user: userId,
        //     date: getCurrentDate(),
        //   },
        // },
      }
    );

      

    const updatedPackingType = await packingTypeModel
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
      message: "Packing type updated successfully",
      data: updatedPackingType,
    });
  } catch (error) {
    console.error("Error updating packing type:", error);
    res.status(500).json({
      success: false,
      message: "Error updating packing type",
      error: error.message,
    });
  }
};

export const deletePackingType = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedPackingType = await packingTypeModel.findOneAndDelete({ id });

    if (!deletedPackingType) {
      return res.status(404).json({
        success: false,
        message: "Packing type not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Packing type deleted successfully",
      data: deletedPackingType,
    });
  } catch (error) {
    console.error("Error deleting packing type:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting packing type",
      error: error.message,
    });
  }
};