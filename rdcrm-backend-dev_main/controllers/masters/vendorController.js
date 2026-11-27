import mongoose from "mongoose";
import { nanoid } from "nanoid";
import vendorModel from "../../models/masters/vendorModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import { escapeRegex } from "../../helpers/escapeRegex.js";

// export const getVendorNameList = async (req, res) => {
//   try {
//     const vendors = await vendorModel
//       .find()
//       .select("id _id name")
//       .populate({
//         path: "service_category",
//         select: "id name",
//       })
//       .sort({ name: 1 });

//     res.status(200).json({
//       success: true,
//       count: vendors.length,
//       data: vendors,
//     });
//   } catch (error) {
//     console.error("Error fetching vendor list:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching vendor list",
//       error: error.message,
//     });
//   }
// };


export const getAllVendors = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page));
    const limit = req.query.limit ? Math.min(100, Math.max(1, Number(req.query.limit))) : null;
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";

    const sortField = req.query.sortBy?.trim() || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
    const is_active = req.query.is_active;

    let query = {};

    // Search filter
    if (search) {
      const safeSearch = escapeRegex(search);
      query.name = { $regex: safeSearch, $options: "i" };
    }

    // Handle is_active filter
    if (is_active !== undefined && is_active !== "" && is_active !== null) {
      if (["true", true, "1", 1].includes(is_active)) {
        query.is_active = true;
      } else if (["false", false, "0", 0].includes(is_active)) {
        query.is_active = false;
      }
    }


    const pipeline = [
      { $match: query },


      // Contract Type
      {
        $lookup: {
          from: "contract_types",
          localField: "contract_type",
          foreignField: "_id",
          as: "contract_type_obj",
          pipeline: [{ $project: { name: 1, is_active: 1 } }]
        }
      },
      { $addFields: { contract_type: { $arrayElemAt: ["$contract_type_obj", 0] } } },

      // Material Categories
      {
        $lookup: {
          from: "material_categories",
          localField: "material_categories",
          foreignField: "_id",
          as: "material_categories",
          pipeline: [{ $project: { name: 1 } }]
        }
      },

      // Material Types
      {
        $lookup: {
          from: "material_types",
          localField: "material_types",
          foreignField: "_id",
          as: "material_types",
          pipeline: [{ $project: { name: 1 } }]
        }
      },

      // GST Tax
      {
        $lookup: {
          from: "tax_masters",
          localField: "gst_tax",
          foreignField: "_id",
          as: "gst_tax_obj",
          pipeline: [{ $project: { tax_name: 1, tax_rate: 1, tax_type: 1 } }]
        }
      },
      { $addFields: { gst_tax: { $arrayElemAt: ["$gst_tax_obj", 0] } } },

      // TDS Tax
      {
        $lookup: {
          from: "tax_masters",
          localField: "tds_tax",
          foreignField: "_id",
          as: "tds_tax_obj",
          pipeline: [{ $project: { tax_name: 1, tax_rate: 1, tax_type: 1 } }]
        }
      },
      { $addFields: { tds_tax: { $arrayElemAt: ["$tds_tax_obj", 0] } } },

      // Created By
      {
        $lookup: {
          from: "users",
          localField: "created_by",
          foreignField: "_id",
          as: "created_by_user",
          pipeline: [
            { $project: { name: 1, username: 1, image: 1 } }
          ]
        }
      },
      { $addFields: { created_by: { $arrayElemAt: ["$created_by_user", 0] } } },

      /// Extract updated_by.user → build updated_by_user_ids array
      {
        $addFields: {
          updated_by_user_ids: {
            $map: {
              input: "$updated_by",
              as: "u",
              in: "$$u.user",
            },
          },
        },
      },

      // Lookup users for updated_by
      {
        $lookup: {
          from: "users",
          localField: "updated_by_user_ids",
          foreignField: "_id",
          as: "updated_by_users",
        },
      },

      // Merge user details back into updated_by array
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

      {
        $addFields: {
          is_active_sort_value:
            sortField === "is_active" || sortField === "status"
              ? { $cond: [{ $eq: ["$is_active", true] }, 0, 1] }
              : null
        }
      },

      {
        $sort: {
          [sortField === "contract_type"
            ? "contract_type.name"
            : sortField === "is_active"
              ? "is_active_sort_value"
              : sortField === "status"
                ? "is_active_sort_value"
                : sortField]: sortOrder,
          createdAt: -1
        }
      },

      {
        $project: {
          contract_type_obj: 0,
          created_by_user: 0,
          updated_by_users: 0
        }
      }
    ];

    if (limit) {
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });
    }

    const vendors = await vendorModel.aggregate(pipeline).collation({ locale: "en", strength: 2 });

    const total = await vendorModel.countDocuments(query);

    res.status(200).json({
      success: true,
      count: vendors.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: vendors
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};


export const getVendorNameList = async (req, res) => {
  try {
    const { include_inactive_ids } = req.query;

    let query = {};

    if (include_inactive_ids) {
      console.log(include_inactive_ids)
      // For edit mode: show active vendors + specific inactive vendors linked to this item
      const inactiveIds = include_inactive_ids.split(",").filter((id) => id);
      query = {
        $or: [{ is_active: true }, { _id: { $in: inactiveIds } }],
      };
    } else {
      query = { is_active: true };
    }

    const vendors = await vendorModel
      .find(query)
      .select("id _id name is_active")
      .populate({
        path: "material_categories",
        select: "id name",
      })
      .populate({
        path: "material_types",
        select: "id name",
      })
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: vendors.length,
      data: vendors,
    });
  } catch (error) {
    console.error("Error fetching vendor list:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching vendor list",
      error: error.message,
    });
  }
};
export const getVendorById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = mongoose.isValidObjectId(id) ? { $or: [{ _id: id }, { id }] } : { id };
    const vendor = await vendorModel
      .findOne(query)
      .select(
        "id name email mobile_no material_categories material_types contract_type address gst_tax gst_rate tds_tax tds_rate is_active created_by"
      )

      .populate({
        path: "material_categories",
        select: "id name",
      })
      .populate({
        path: "material_types",
        select: "id name",
      })
      .populate({
        path: "contract_type",
        select: "id name is_active",
      })
      .populate({
        path: "gst_tax",
        select: "tax_name tax_type tax_rate is_active",
      })
      .populate({
        path: "tds_tax",
        select: "tax_name tax_type tax_rate is_active",
      })
      .populate({
        path: "created_by",
        select: "-password -permission -created_at -updated_by -updated_at",
      })
      .populate({
        path: "updated_by.user",
        select: "-password -permission -created_at -updated_by -updated_at",
      });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    res.status(200).json({
      success: true,
      data: vendor,
    });
  } catch (error) {
    console.error("Error getting vendor:", error);
    res.status(500).json({
      success: false,
      message: "Error getting vendor",
      error: error.message,
    });
  }
};

export const createVendor = async (req, res) => {
  try {
    const {
      name,
      email,
      mobile_no,
      material_categories,
      material_types,
      contract_type,
      address,
      gst_tax,
      gst_rate,
      tds_tax,
      tds_rate,
      is_active,
    } = req.body;

    if (!name || !email || !mobile_no || !material_categories || material_categories.length === 0 || !contract_type) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const existingVendor = await vendorModel.findOne({ name });
    if (existingVendor) {
      return res.status(409).json({
        success: false,
        message: "Vendor name already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newVendor = new vendorModel({
      id: nanoid(16),
      name,
      email,
      mobile_no,
      material_categories: material_categories || [],
      material_types: material_types || [],
      contract_type,
      address: address ?? "",
      gst_tax: gst_tax || null,
      gst_rate: Number(gst_rate || 0),
      tds_tax: tds_tax || null,
      tds_rate: Number(tds_rate || 0),
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
    });

    const savedVendor = await newVendor.save();

    res.status(201).json({
      success: true,
      message: "Vendor created successfully",
      data: savedVendor,
    });
  } catch (error) {
    console.error("Error creating vendor:", error);
    res.status(500).json({
      success: false,
      message: "Error creating vendor",
      error: error.message,
    });
  }
};

export const updateVendor = async (req, res) => {
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

    const query = mongoose.isValidObjectId(id) ? { $or: [{ _id: id }, { id }] } : { id };
    const vendor = await vendorModel.findOne(query);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    if (updateData.name && updateData.name !== vendor.name) {
      const nameExists = await vendorModel.findOne({ name: updateData.name, _id: { $ne: vendor._id } });
      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: "Vendor name already in use",
        });
      }
    }

    const otherUpdates = { ...updateData };
    delete otherUpdates.updated_by;

    if (otherUpdates.gst_tax === "" || otherUpdates.gst_tax === undefined) {
      otherUpdates.gst_tax = null;
    }
    if (otherUpdates.tds_tax === "" || otherUpdates.tds_tax === undefined) {
      otherUpdates.tds_tax = null;
    }
    if (otherUpdates.gst_rate !== undefined) {
      otherUpdates.gst_rate = Number(otherUpdates.gst_rate || 0);
    }
    if (otherUpdates.tds_rate !== undefined) {
      otherUpdates.tds_rate = Number(otherUpdates.tds_rate || 0);
    }

    await vendorModel.updateOne(
      query,
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

    const updatedVendor = await vendorModel
      .findOne(query)
      .select(
        "id name email mobile_no material_categories material_types contract_type address gst_tax gst_rate tds_tax tds_rate is_active created_by"
      )

      .populate({
        path: "material_categories",
        select: "id name",
      })
      .populate({
        path: "material_types",
        select: "id name",
      })
      .populate({
        path: "contract_type",
        select: "id name is_active",
      })
      .populate({
        path: "gst_tax",
        select: "tax_name tax_type tax_rate is_active",
      })
      .populate({
        path: "tds_tax",
        select: "tax_name tax_type tax_rate is_active",
      })
      .populate({
        path: "created_by",
        select: "-password -permission -created_at -updated_by -updated_at",
      })
      .populate({
        path: "updated_by.user",
        select: "-password -permission -created_at -updated_by -updated_at",
      });

    res.status(200).json({
      success: true,
      message: "Vendor updated successfully",
      data: updatedVendor,
    });
  } catch (error) {
    console.error("Error updating vendor:", error);
    res.status(500).json({
      success: false,
      message: "Error updating vendor",
      error: error.message,
    });
  }
};

export const deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const query = mongoose.isValidObjectId(id) ? { $or: [{ _id: id }, { id }] } : { id };

    const deletedVendor = await vendorModel.findOneAndDelete(query);

    if (!deletedVendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Vendor deleted successfully",
      data: deletedVendor,
    });
  } catch (error) {
    console.error("Error deleting vendor:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting vendor",
      error: error.message,
    });
  }
};
