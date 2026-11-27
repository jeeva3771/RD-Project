import { nanoid } from "nanoid";
import EnquirySubCategoryModel from "../../models/masters/enquirySubCatergoryModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import { escapeRegex } from "../../helpers/escapeRegex.js";

export const getAllEnquirySubCategories = async (req, res) => {
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

    const total = await EnquirySubCategoryModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

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

    const subcategories = await EnquirySubCategoryModel.aggregate(
      pipeline
    ).collation({ locale: "en", strength: 2 });
    // const subcategories = await EnquirySubCategoryModel.find(query)
    //   .populate("created_by")
    //   .populate("updated_by.user")
    //   .sort({ createdAt: -1 })
    //   .skip(skip)
    //   .limit(limit);

    res.status(200).json({
      success: true,
      message: "Enquiry subcategories retrieved successfully",
      count: subcategories.length,
      total,
      page,
      totalPages,
      data: subcategories,
    });
  } catch (error) {
    console.error("Error getting enquiry subcategories:", error);
    res.status(500).json({
      success: false,
      message: "Error getting enquiry subcategories",
      error: error.message,
    });
  }
};

export const getEnquirySubCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const subcategory = await EnquirySubCategoryModel.findOne({ id })
      .populate("created_by")
      .populate("updated_by.user");

    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Enquiry subcategory not found",
      });
    }

    res.status(200).json({
      success: true,
      data: subcategory,
    });
  } catch (error) {
    console.error("Error getting enquiry subcategory:", error);
    res.status(500).json({
      success: false,
      message: "Error getting enquiry subcategory",
      error: error.message,
    });
  }
};

export const createEnquirySubCategory = async (req, res) => {
  try {
    const { name, is_active } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const existing = await EnquirySubCategoryModel.findOne({ name });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Enquiry subcategory already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newSubCategory = new EnquirySubCategoryModel({
      id: nanoid(16),
      name,
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
    });

    const saved = await newSubCategory.save();

    res.status(201).json({
      success: true,
      message: "Enquiry subcategory created successfully",
      data: saved,
    });
  } catch (error) {
    console.error("Error creating enquiry subcategory:", error);
    res.status(500).json({
      success: false,
      message: "Error creating enquiry subcategory",
      error: error.message,
    });
  }
};

export const updateEnquirySubCategory = async (req, res) => {
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

    const subcategory = await EnquirySubCategoryModel.findOne({ id });
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Enquiry subcategory not found",
      });
    }

    if (updateData.name && updateData.name !== subcategory.name) {
      const nameExists = await EnquirySubCategoryModel.findOne({
        name: updateData.name,
      });
      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: "Enquiry subcategory name already in use",
        });
      }
    }

    const otherUpdates = { ...updateData };
    delete otherUpdates.updated_by;

    await EnquirySubCategoryModel.updateOne(
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

    const updated = await EnquirySubCategoryModel.findOne({ id });

    res.status(200).json({
      success: true,
      message: "Enquiry subcategory updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating enquiry subcategory:", error);
    res.status(500).json({
      success: false,
      message: "Error updating enquiry subcategory",
      error: error.message,
    });
  }
};

export const deleteEnquirySubCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const subcategory = await EnquirySubCategoryModel.findOne({ id });
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: "Enquiry subcategory not found",
      });
    }

    const deleted = await EnquirySubCategoryModel.findOneAndDelete({ id });

    res.status(200).json({
      success: true,
      message: "Enquiry subcategory deleted successfully",
      data: deleted,
    });
  } catch (error) {
    console.error("Error deleting enquiry subcategory:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting enquiry subcategory",
      error: error.message,
    });
  }
};
