import { nanoid } from "nanoid";
import EnquiryCategoryModel from "../../models/masters/enquiryCatergoryModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import { escapeRegex } from "../../helpers/escapeRegex.js";

  export const getAllEnquiryCategories = async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page));
      const limit = req.query.limit
        ? Math.min(100, Math.max(1, parseInt(req.query.limit)))
        : null;
      const skip = limit ? (page - 1) * limit : 0;

      const search = req.query.search?.trim() || "";
      const is_active = req.query.is_active;
      const sortField = req.query.sortField?.trim();
      const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

      const query = {};

      // Search filter
      if (search) {
        const safeSearch = escapeRegex(search);
        query.name = { $regex: safeSearch, $options: "i" };
      }

      // FIXED is_active HANDLING
      if (is_active !== undefined && is_active !== "" && is_active !== null) {
        if (["true", true, "1", 1].includes(is_active)) {
          query.is_active = true;
        } else if (["false", false, "0", 0].includes(is_active)) {
          query.is_active = false;
        }
      }

      const totalEnquiryCategory = await EnquiryCategoryModel.countDocuments(
        query
      );
      const totalPages = Math.ceil(totalEnquiryCategory / limit);
      
      // Detect if we are sorting a boolean field
      const isBooleanSort = sortField === "is_active";
      
      const pipeline = [
        { $match: query },

        // JOIN created_by
        {
          $lookup: {
            from: "users",
            localField: "created_by",
            foreignField: "_id",
            as: "created_by_user",
          },
        },
        {
          $addFields: {
            created_by_user: { $arrayElemAt: ["$created_by_user", 0] },
          },
        },

        // JOIN updated_by (array)
        {
          $addFields: {
            updated_by_user_ids: {
              $map: { input: "$updated_by", as: "u", in: "$$u.user" },
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "updated_by_user_ids",
            foreignField: "_id",
            as: "updated_by_users",
          },
        },
        {
          $addFields: {
            updated_by: {
              $map: {
                input: "$updated_by",
                as: "u",
                in: {
                  user: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$updated_by_users",
                          as: "usr",
                          cond: { $eq: ["$$usr._id", "$$u.user"] },
                        },
                      },
                      0,
                    ],
                  },
                  date: "$$u.date",
                },
              },
            },
          },
        },

        // Sorting
        sortField
          ? {
              $sort: {
                // flip ASC/DESC ONLY for boolean
                [sortField]: isBooleanSort
                  ? sortOrder === 1
                    ? -1
                    : 1 // active first on ASC
                  : sortOrder, // normal sorting for strings/numbers

                createdAt: -1, // secondary sort
              },
            }
          : { $sort: { createdAt: -1 } },

        // Remove temp fields
        {
          $unset: ["updated_by_user_ids", "updated_by_users"],
        },
      ];

      if (limit) {
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: limit });
      }

      console.log("PIPELINE:", JSON.stringify(pipeline));
      const enquiryModel = await EnquiryCategoryModel.aggregate(
        pipeline
      ).collation({ locale: "en", strength: 2 });

      res.status(200).json({
        success: true,
        count: enquiryModel.length,
        total: totalEnquiryCategory,
        page,
        totalPages,
        data: enquiryModel,
      });
      // const total = await EnquiryCategoryModel.countDocuments(query);

      // const categories = await EnquiryCategoryModel.find(query)
      //   .populate("created_by")
      //   .populate("updated_by.user")
      //   .sort({ createdAt: -1 })
      //   .skip(skip)
      //   .limit(limit);

      // const totalPages = Math.ceil(total / limit);

      // res.status(200).json({
      //   success: true,
      //   message: "Enquiry categories retrieved successfully",
      //   count: categories.length,
      //   total,
      //   page,
      //   totalPages,
      //   data: categories,
      // });
    } catch (error) {
      console.error("Error getting enquiry categories:", error);
      res.status(500).json({
        success: false,
        message: "Error getting enquiry categories",
        error: error.message,
      });
    }
  };

export const getEnquiryCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await EnquiryCategoryModel.findOne({ id })
      .populate("created_by")
      .populate("updated_by.user");

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Enquiry category not found",
      });
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("Error getting enquiry category:", error);
    res.status(500).json({
      success: false,
      message: "Error getting enquiry category",
      error: error.message,
    });
  }
};

export const createEnquiryCategory = async (req, res) => {
  try {
    const { name, is_active } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const existingCategory = await EnquiryCategoryModel.findOne({ name });
    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: "Enquiry category already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newCategory = new EnquiryCategoryModel({
      id: nanoid(16),
      name,
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
    });

    const savedCategory = await newCategory.save();

    res.status(201).json({
      success: true,
      message: "Enquiry category created successfully",
      data: savedCategory,
    });
  } catch (error) {
    console.error("Error creating enquiry category:", error);
    res.status(500).json({
      success: false,
      message: "Error creating enquiry category",
      error: error.message,
    });
  }
};

export const updateEnquiryCategory = async (req, res) => {
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

    const category = await EnquiryCategoryModel.findOne({ id });
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Enquiry category not found",
      });
    }

    if (updateData.name && updateData.name !== category.name) {
      const nameExists = await EnquiryCategoryModel.findOne({
        name: updateData.name,
      });
      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: "Enquiry category name already in use",
        });
      }
    }

    const otherUpdates = { ...updateData };
    delete otherUpdates.updated_by;

    await EnquiryCategoryModel.updateOne(
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

    const updatedCategory = await EnquiryCategoryModel.findOne({ id });

    res.status(200).json({
      success: true,
      message: "Enquiry category updated successfully",
      data: updatedCategory,
    });
  } catch (error) {
    console.error("Error updating enquiry category:", error);
    res.status(500).json({
      success: false,
      message: "Error updating enquiry category",
      error: error.message,
    });
  }
};

export const deleteEnquiryCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await EnquiryCategoryModel.findOne({ id });
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Enquiry category not found",
      });
    }

    const deleted = await EnquiryCategoryModel.findOneAndDelete({ id });

    res.status(200).json({
      success: true,
      message: "Enquiry category deleted successfully",
      data: deleted,
    });
  } catch (error) {
    console.error("Error deleting enquiry category:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting enquiry category",
      error: error.message,
    });
  }
};
