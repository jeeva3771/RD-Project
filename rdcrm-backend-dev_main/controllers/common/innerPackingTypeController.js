import { nanoid } from "nanoid";
import innerPackingTypeModel from "../../models/masters/common/innerPackingTypeModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";

export const getAllInnerPackingTypes = async (req, res) => {
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

    // 🔍 Search
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    // ✅ is_active filter
    if (is_active !== undefined && is_active !== "" && is_active !== null) {
      if (["true", true, "1", 1].includes(is_active)) {
        query.is_active = true;
      } else if (["false", false, "0", 0].includes(is_active)) {
        query.is_active = false;
      }
    }

    // 🔃 Sorting
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
    } else if (req.query.order) {
      const order = req.query.order === "desc" ? -1 : 1;
      sortOption = { name: order };
    }

    // 📊 Count
    const totalInnerPackingTypes =
      await innerPackingTypeModel.countDocuments(query);

    // 📦 Data
    const innerPackingTypes = await innerPackingTypeModel
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

    const totalPages = Math.ceil(totalInnerPackingTypes / limit);

    res.status(200).json({
      success: true,
      count: innerPackingTypes.length,
      total: totalInnerPackingTypes,
      page,
      totalPages,
      data: innerPackingTypes,
    });
  } catch (error) {
    console.error("Error getting inner packing types:", error);
    res.status(500).json({
      success: false,
      message: "Error getting inner packing types",
      error: error.message,
    });
  }
};


export const getInnerPackingTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    const innerPackingType = await innerPackingTypeModel
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

    if (!innerPackingType) {
      return res.status(404).json({
        success: false,
        message: "Inner packing type not found",
      });
    }

    res.status(200).json({
      success: true,
      data: innerPackingType,
    });
  } catch (error) {
    console.error("Error getting inner packing type:", error);
    res.status(500).json({
      success: false,
      message: "Error getting inner packing type",
      error: error.message,
    });
  }
};

export const createInnerPackingType = async (req, res) => {
  try {
    const { name, is_active } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    const existingInnerPackingType = await innerPackingTypeModel.findOne({ name });
    if (existingInnerPackingType) {
      return res.status(409).json({
        success: false,
        message: "Inner packing type name already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newInnerPackingType = new innerPackingTypeModel({
      id: nanoid(16),
      name,
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
    });

    const savedInnerPackingType = await newInnerPackingType.save();

    res.status(201).json({
      success: true,
      message: "Inner packing type created successfully",
      data: savedInnerPackingType,
    });
  } catch (error) {
    console.error("Error creating inner packing type:", error);
    res.status(500).json({
      success: false,
      message: "Error creating inner packing type",
      error: error.message,
    });
  }
};

export const updateInnerPackingType = async (req, res) => {
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

    const innerPackingType = await innerPackingTypeModel.findOne({ id });
    if (!innerPackingType) {
      return res.status(404).json({
        success: false,
        message: "Inner packing type not found",
      });
    }

    if (updateData.name && updateData.name !== innerPackingType.name) {
      const nameExists = await innerPackingTypeModel.findOne({ name: updateData.name });
      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: "Inner packing type name already in use",
        });
      }
    }

    const otherUpdates = { ...updateData };
    delete otherUpdates.updated_by;

    await innerPackingTypeModel.updateOne(
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

    const updatedInnerPackingType = await innerPackingTypeModel
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
      message: "Inner packing type updated successfully",
      data: updatedInnerPackingType,
    });
  } catch (error) {
    console.error("Error updating inner packing type:", error);
    res.status(500).json({
      success: false,
      message: "Error updating inner packing type",
      error: error.message,
    });
  }
};

export const deleteInnerPackingType = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedInnerPackingType = await innerPackingTypeModel.findOneAndDelete({ id });

    if (!deletedInnerPackingType) {
      return res.status(404).json({
        success: false,
        message: "Inner packing type not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Inner packing type deleted successfully",
      data: deletedInnerPackingType,
    });
  } catch (error) {
    console.error("Error deleting inner packing type:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting inner packing type",
      error: error.message,
    });
  }
};