import { nanoid } from "nanoid";
import customerModel from "../../models/masters/customerModel.js";
import userModel from "../../models/users/userModel.js";
import EnquiryJobIntegration from "../../models/enquiry/enquiryJobIntegrationModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import mongoose from "mongoose";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
import { escapeRegex } from "../../helpers/escapeRegex.js";

export const getAllCustomers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";

    const sortBy = req.query.sortBy || "createdAt";
    let sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    // Reverse logic for boolean field
    if (sortBy === "is_active") {
      sortOrder = sortOrder === 1 ? -1 : 1;
    }

    // MAIN QUERY
    let matchQuery = {};
    const andConditions = [];

    // Search filter
    if (search) {
      const safeSearch = escapeRegex(search);
      andConditions.push({ name: { $regex: safeSearch, $options: "i" } });
    }

    // Role-based client visibility:
    // Admin & Client Servicing Manager see ALL clients.
    // Client Servicing Executive sees ONLY clients assigned to them.
    const userRole = (req.user?.role || "").toLowerCase();
    const isHead = req.user?.is_head === true;
    const isAdminOrManager =
      userRole.includes("admin") ||
      userRole.includes("manager") ||
      userRole.includes("head") ||
      isHead;

    const isDropdownOrAll = req.query.all === "true" || req.query.dropdown === "true";
    if (!isAdminOrManager && !isDropdownOrAll) {
      let userObjId = null;
      if (req.user?._id && mongoose.Types.ObjectId.isValid(req.user._id)) {
        userObjId = new mongoose.Types.ObjectId(req.user._id);
      } else if (req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)) {
        userObjId = new mongoose.Types.ObjectId(req.user.id);
      } else if (req.user?.id) {
        try {
          const dbUser = await userModel.findOne({ id: req.user.id }).select("_id").lean();
          if (dbUser?._id && mongoose.Types.ObjectId.isValid(dbUser._id)) {
            userObjId = new mongoose.Types.ObjectId(dbUser._id);
          }
        } catch (e) {
          console.warn("Could not resolve userObjId in getAllCustomers:", e?.message);
        }
      }

      if (userObjId) {
        const userFilterConditions = [
          { client_servicing_persons: userObjId },
          { owner: userObjId },
          { rd_account_managers: userObjId },
          { created_by: userObjId },
        ];
        andConditions.push({ $or: userFilterConditions });
      } else {
        andConditions.push({ _id: null });
      }
    }

    if (andConditions.length === 1) {
      Object.assign(matchQuery, andConditions[0]);
    } else if (andConditions.length > 1) {
      matchQuery.$and = andConditions;
    }

    // Fast lightweight summary mode (skips heavy $lookup joins and nested address/contact arrays)
    if (req.query.mode === "summary") {
      const sortField = sortBy || "createdAt";
      const [summaryCustomers, totalCustomers] = await Promise.all([
        customerModel
          .find(matchQuery)
          .select("_id id name short_name color_hue contact_person mobile_no email stats")
          .sort({ [sortField]: sortOrder, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        customerModel.countDocuments(matchQuery),
      ]);

      // Dynamically attach live job counts from enquiry_flows_integration
      if (summaryCustomers.length > 0) {
        try {
          const custIdMap = new Map();
          const allIdKeys = [];
          summaryCustomers.forEach((c) => {
            const keys = [
              String(c._id),
              ...(mongoose.Types.ObjectId.isValid(c._id) ? [new mongoose.Types.ObjectId(c._id)] : []),
              ...(c.id ? [String(c.id)] : []),
            ];
            keys.forEach((k) => custIdMap.set(String(k), c));
            allIdKeys.push(...keys);
          });

          const dynamicStats = await EnquiryJobIntegration.aggregate([
            {
              $match: {
                customer_id: { $in: allIdKeys },
                is_lost: { $ne: true },
              },
            },
            {
              $group: {
                _id: "$customer_id",
                total_enquiries: { $sum: 1 },
                in_process_jobs: {
                  $sum: {
                    $cond: [
                      { $in: ["$stage", ["enquiry", "brief", "sample", "production", "ready_for_dispatch", "dispatched"]] },
                      1,
                      0,
                    ],
                  },
                },
                completed_jobs: {
                  $sum: {
                    $cond: [{ $in: ["$stage", ["delivered", "closed"]] }, 1, 0],
                  },
                },
              },
            },
          ]);

          const aggregatedPerCust = new Map();
          dynamicStats.forEach((st) => {
            const matchedCust = custIdMap.get(String(st._id));
            if (matchedCust) {
              const custKey = String(matchedCust._id);
              const prev = aggregatedPerCust.get(custKey) || { total_jobs: 0, enquiries_count: 0, won_count: 0 };
              prev.total_jobs += st.in_process_jobs || 0;
              prev.enquiries_count += st.total_enquiries || 0;
              prev.won_count += st.completed_jobs || 0;
              aggregatedPerCust.set(custKey, prev);
            }
          });

          summaryCustomers.forEach((c) => {
            const live = aggregatedPerCust.get(String(c._id));
            c.stats = {
              ...(c.stats || {}),
              total_jobs: live ? live.total_jobs : 0,
              enquiries_count: live ? live.enquiries_count : 0,
              won_count: live ? live.won_count : 0,
              last_enquiry_summary: live ? (c.stats?.last_enquiry_summary || "") : "",
            };
          });
        } catch (aggErr) {
          console.warn("Error enriching summary customers with live enquiry stats:", aggErr);
        }
      }

      return res.status(200).json({
        success: true,
        count: summaryCustomers.length,
        total: totalCustomers,
        page,
        totalPages: Math.ceil(totalCustomers / limit),
        data: summaryCustomers,
      });
    }

    const totalCustomers = await customerModel.countDocuments(matchQuery);

    // AGGREGATION PIPELINE
    const pipeline = [
      { $match: matchQuery },

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

      // JOIN owner (RD Account Manager)
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner_user",
        },
      },
      {
        $addFields: {
          owner_user: { $arrayElemAt: ["$owner_user", 0] },
        },
      },
      {
        $addFields: {
          owner_name: {
            $cond: {
              if: {
                $and: [
                  { $ne: ["$owner_name", null] },
                  { $ne: ["$owner_name", ""] }
                ]
              },
              then: "$owner_name",
              else: { $ifNull: ["$owner_user.name", ""] }
            }
          }
        },
      },

      // JOIN rd_account_managers (multiple users)
      {
        $lookup: {
          from: "users",
          localField: "rd_account_managers",
          foreignField: "_id",
          as: "rd_account_managers",
          pipeline: [
            {
              $project: {
                _id: 1,
                id: 1,
                name: 1,
                email: 1,
                username: 1,
                role: 1,
              },
            },
          ],
        },
      },

      // JOIN client_servicing_persons (multiple users)
      {
        $lookup: {
          from: "users",
          localField: "client_servicing_persons",
          foreignField: "_id",
          as: "client_servicing_persons",
          pipeline: [
            {
              $project: {
                _id: 1,
                id: 1,
                name: 1,
                email: 1,
                username: 1,
                role: 1,
              },
            },
          ],
        },
      },

      // JOIN gst_tax
      {
        $lookup: {
          from: "tax_masters",
          localField: "gst_tax",
          foreignField: "_id",
          as: "gst_tax",
        },
      },
      {
        $addFields: {
          gst_tax: { $arrayElemAt: ["$gst_tax", 0] },
        },
      },

      // JOIN tds_tax
      {
        $lookup: {
          from: "tax_masters",
          localField: "tds_tax",
          foreignField: "_id",
          as: "tds_tax",
        },
      },
      {
        $addFields: {
          tds_tax: { $arrayElemAt: ["$tds_tax", 0] },
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

      // SORTING (same system as machines & units)
      ...(sortBy
        ? [
            {
              $sort: {
                [sortBy]: sortOrder,
                createdAt: -1,
              },
            },
          ]
        : [{ $sort: { createdAt: -1 } }]),

      // Pagination
      ...(skip > 0 ? [{ $skip: skip }] : []),
      ...(limit > 0 ? [{ $limit: limit }] : []),

      // Remove temp fields
      {
        $unset: [
          "updated_by_user_ids",
          "updated_by_users",
        ],
      },
    ];

    const customers = await customerModel.aggregate(pipeline).collation({
      locale: "en",
      strength: 2,
    });

    const totalPages = Math.ceil(totalCustomers / limit);

    res.status(200).json({
      success: true,
      count: customers.length,
      total: totalCustomers,
      page,
      totalPages,
      data: customers,
    });
  } catch (error) {
    console.error("Error getting customers:", error);
    res.status(500).json({
      success: false,
      message: "Error getting customers",
      error: error.message,
    });
  }
};

export const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const filter = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ id }, { _id: id }] }
      : { id };
    const customer = await customerModel
      .findOne(filter)
      .populate({
        path: "delivery_type",
        select: "id name is_active",
      })
      .populate({
        path: "courier",
        select: "id name is_active",
      })
      .populate({
        path: "payment_terms",
        select: "id name is_active",
      })
      .populate("gst_tax")
      .populate("tds_tax")
      .populate({
        path: "owner",
        select: "name email role",
      })
      .populate({
        path: "rd_account_managers",
        select: "id name email username role",
        populate: { path: "role", select: "name" },
      })
      .populate({
        path: "client_servicing_persons",
        select: "id name email username role",
        populate: { path: "role", select: "name" },
      })
      .populate({
        path: "created_by",
        select: "-password -permission -created_at -updated_by -updated_at",
      })
      .populate({
        path: "updated_by.user",
        select: "-password -permission -created_at -updated_by -updated_at",
      });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error("Error getting customer:", error);
    res.status(500).json({
      success: false,
      message: "Error getting customer",
      error: error.message,
    });
  }
};

export const createCustomer = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const {
      name,
      contact_person,
      mobile_no,
      email,
      address,
      delivery_type,
      courier,
      payment_terms,
      enquiries_origin,
      is_active,
      short_name,
      color_hue,
      owner,
      owner_name,
      rd_account_managers,
      client_servicing_persons,
      contacts,
      additional_contacts,
      terms_text,
      advance_percentage,
      credit_days,
      outstanding_amount,
      since_year,
      season_insight,
      stats,
      gst_status,
      gst_remind_stages,
      gst_tax,
      gst_rate,
      tds_tax,
      tds_rate,
    } = req.body;

    let resolvedContactPerson = contact_person || "";
    let resolvedMobileNo = mobile_no || null;
    let resolvedEmail = email || "";

    if (Array.isArray(contacts) && contacts.length > 0) {
      const primary = contacts.find((c) => c.is_primary) || contacts[0];
      if (primary) {
        resolvedContactPerson = primary.name || resolvedContactPerson;
        resolvedMobileNo = Number(String(primary.mobile_no).replace(/\D/g, "")) || resolvedMobileNo;
        resolvedEmail = primary.email || resolvedEmail;
      }
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required",
      });
    }

    if (resolvedEmail && !emailRegex.test(resolvedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format. Please enter a valid email address.",
      });
    }

    if (
      Array.isArray(address) &&
      address.length > 0 &&
      !address.every(
        (item) => item.address_1 && item.city && item.state && item.postal_code
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid address format",
      });
    }

    const existingCustomer = await customerModel.findOne({ name });
    if (existingCustomer) {
      return res.status(409).json({
        success: false,
        message: "Customer name already exists",
      });
    }

    // Auto-calculate 2-letter monogram short_name if not provided
    const words = name.trim().split(/\s+/);
    const autoShort = short_name || (words.length >= 2 
      ? (words[0][0] + words[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase());

    // Auto-calculate theme color hue if not provided
    const hues = ["ind", "mint", "gold", "coral"];
    const hash = name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const autoHue = color_hue || hues[hash % hues.length];

    const parseUserIds = (val) => {
      if (!val) return [];
      const arr = Array.isArray(val) ? val : [val];
      return arr
        .map((item) => (typeof item === "object" && item?._id ? item._id : item))
        .filter((id) => mongoose.isValidObjectId(id));
    };

    const resolvedRdAccountManagers = parseUserIds(rd_account_managers);
    const resolvedClientServicing = parseUserIds(client_servicing_persons);
    if (userId && mongoose.isValidObjectId(userId) && !resolvedClientServicing.some((id) => String(id) === String(userId))) {
      resolvedClientServicing.push(new mongoose.Types.ObjectId(userId));
    }

    const customerData = {
      id: nanoid(16),
      name: name.trim(),
      contact_person: resolvedContactPerson || "",
      mobile_no: resolvedMobileNo ? (Number(String(resolvedMobileNo).replace(/\D/g, "")) || null) : null,
      email: resolvedEmail || "",
      address: address ?? [],
      is_active: is_active ?? true,
      short_name: autoShort,
      color_hue: autoHue,
      owner: owner || (resolvedRdAccountManagers.length > 0 ? resolvedRdAccountManagers[0] : userId),
      owner_name: owner_name || null,
      rd_account_managers: resolvedRdAccountManagers,
      client_servicing_persons: resolvedClientServicing,
      contacts: contacts || [],
      additional_contacts: additional_contacts || [],
      terms_text: terms_text || "50% advance against order",
      advance_percentage: advance_percentage !== undefined ? advance_percentage : 50,
      credit_days: credit_days || 0,
      outstanding_amount: outstanding_amount || 0,
      since_year: since_year || 2024,
      season_insight: season_insight || "",
      stats: stats || { total_jobs: 0, enquiries_count: 0, won_count: 0, avg_order_value: 0 },
      gst_status: gst_status || "have",
      gst_remind_stages: gst_remind_stages || [],
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
    };

    // Conditionally add optional fields
    if (delivery_type) customerData.delivery_type = delivery_type;
    if (courier) customerData.courier = courier;
    if (payment_terms) customerData.payment_terms = payment_terms;
    if (enquiries_origin) customerData.enquiries_origin = enquiries_origin;

    const handleObjectIdField = (val) => {
      if (val === "" || val === null || val === undefined) return null;
      if (mongoose.isValidObjectId(val)) return val;
      return undefined;
    };

    if (gst_tax) customerData.gst_tax = handleObjectIdField(gst_tax);
    if (gst_rate !== undefined) customerData.gst_rate = Number(gst_rate) || 0;
    if (tds_tax) customerData.tds_tax = handleObjectIdField(tds_tax);
    if (tds_rate !== undefined) customerData.tds_rate = Number(tds_rate) || 0;

    // Save customer
    const newCustomer = new customerModel(customerData);
    const savedCustomer = await newCustomer.save();

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: savedCustomer,
    });
  } catch (error) {
    console.log(error);
    console.error("Error creating customer:", error);
    res.status(500).json({
      success: false,
      message: "Error creating customer",
      error: error.message,
    });
  }
};

export const updateCustomer = async (req, res) => {
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

    const customer = await customerModel.findOne({ id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Prevent duplicate name
    if (updateData.name && updateData.name !== customer.name) {
      const nameExists = await customerModel.findOne({ name: updateData.name });
      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: "Customer name already in use",
        });
      }
    }

    if (!emailRegex.test(updateData.email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format. Please enter a valid email address.",
      });
    }

    if (
      !updateData.name ||
      !updateData.contact_person ||
      !updateData.mobile_no ||
      !updateData.email
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Validate address array (if provided)
    if (
      updateData.address &&
      (!Array.isArray(updateData.address) ||
        !updateData.address.every(
          (item) =>
            item.address_1 && item.city && item.state && item.postal_code
        ))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid address format",
      });
    }

    const handleObjectIdField = (val) => {
      if (val === "") return null; // clear field
      if (mongoose.isValidObjectId(val)) return val; // valid ObjectId
      return undefined; // skip
    };

    const updateFields = {
      name: updateData.name,
      contact_person: updateData.contact_person,
      mobile_no: updateData.mobile_no,
      email: updateData.email,
      address: updateData.address ?? customer.address,
      is_active:
        typeof updateData.is_active === "boolean"
          ? updateData.is_active
          : customer.is_active,
      updated_at: getCurrentDate(),
    };
    const deliveryTypeVal = handleObjectIdField(updateData.delivery_type);
    if (deliveryTypeVal !== undefined)
      updateFields.delivery_type = deliveryTypeVal;

    const courierVal = handleObjectIdField(updateData.courier);
    if (courierVal !== undefined) updateFields.courier = courierVal;

    const paymentVal = handleObjectIdField(updateData.payment_terms);
    if (paymentVal !== undefined) updateFields.payment_terms = paymentVal;

    // enquiries_origin can be string, so check separately
    if (updateData.enquiries_origin?.trim())
      updateFields.enquiries_origin = updateData.enquiries_origin.trim();

    // New Enquiry Flow fields
    if (updateData.short_name) updateFields.short_name = updateData.short_name.trim();
    if (updateData.color_hue) updateFields.color_hue = updateData.color_hue;
    if (updateData.owner) updateFields.owner = handleObjectIdField(updateData.owner);
    if (updateData.owner_name !== undefined) updateFields.owner_name = updateData.owner_name;

    const parseUserIds = (val) => {
      if (!val) return [];
      const arr = Array.isArray(val) ? val : [val];
      return arr
        .map((item) => (typeof item === "object" && item?._id ? item._id : item))
        .filter((id) => mongoose.isValidObjectId(id));
    };

    if (updateData.rd_account_managers !== undefined) {
      updateFields.rd_account_managers = parseUserIds(updateData.rd_account_managers);
      if (updateFields.rd_account_managers.length > 0) {
        updateFields.owner = updateFields.rd_account_managers[0];
      } else if (!updateData.owner) {
        updateFields.owner = null;
      }
    }
    if (updateData.client_servicing_persons !== undefined) {
      updateFields.client_servicing_persons = parseUserIds(updateData.client_servicing_persons);
    }
    if (Array.isArray(updateData.contacts)) {
      updateFields.contacts = updateData.contacts;
      const primary = updateData.contacts.find((c) => c.is_primary) || updateData.contacts[0];
      if (primary) {
        updateFields.contact_person = primary.name;
        updateFields.mobile_no = Number(String(primary.mobile_no).replace(/\D/g, "")) || updateFields.mobile_no;
        updateFields.email = primary.email;
      }
    }
    if (Array.isArray(updateData.additional_contacts)) updateFields.additional_contacts = updateData.additional_contacts;
    if (updateData.terms_text) updateFields.terms_text = updateData.terms_text;
    if (updateData.advance_percentage !== undefined) updateFields.advance_percentage = updateData.advance_percentage;
    if (updateData.credit_days !== undefined) updateFields.credit_days = updateData.credit_days;
    if (updateData.outstanding_amount !== undefined) updateFields.outstanding_amount = updateData.outstanding_amount;
    if (updateData.since_year !== undefined) updateFields.since_year = updateData.since_year;
    if (updateData.season_insight) updateFields.season_insight = updateData.season_insight;
    if (updateData.stats) updateFields.stats = updateData.stats;
    if (updateData.gst_status) updateFields.gst_status = updateData.gst_status;
    if (updateData.gst_remind_stages) updateFields.gst_remind_stages = updateData.gst_remind_stages;

    const gstTaxVal = handleObjectIdField(updateData.gst_tax);
    if (gstTaxVal !== undefined) updateFields.gst_tax = gstTaxVal;
    if (updateData.gst_rate !== undefined) updateFields.gst_rate = Number(updateData.gst_rate) || 0;

    const tdsTaxVal = handleObjectIdField(updateData.tds_tax);
    if (tdsTaxVal !== undefined) updateFields.tds_tax = tdsTaxVal;
    if (updateData.tds_rate !== undefined) updateFields.tds_rate = Number(updateData.tds_rate) || 0;

    // Update
    await customerModel.updateOne(
      { id },
      {
        $set: {
          ...updateFields,
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

    // Fetch updated customer with populated fields
    const updatedCustomer = await customerModel
      .findOne({ id })
      .populate("delivery_type", "id name is_active")
      .populate("courier", "id name is_active")
      .populate("payment_terms", "id name is_active")
      .populate("owner", "name email role")
      .populate({
        path: "rd_account_managers",
        select: "id name email username role",
        populate: { path: "role", select: "name" },
      })
      .populate({
        path: "client_servicing_persons",
        select: "id name email username role",
        populate: { path: "role", select: "name" },
      })
      .populate("gst_tax")
      .populate("tds_tax")
      .populate(
        "created_by",
        "-password -permission -created_at -updated_by -updated_at"
      )
      .populate(
        "updated_by.user",
        "-password -permission -created_at -updated_by -updated_at"
      );

    return res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      data: updatedCustomer,
    });
  } catch (error) {
    console.error("Error updating customer:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating customer",
      error: error.message,
    });
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedCustomer = await customerModel.findOneAndDelete({ id });

    if (!deletedCustomer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
      data: deletedCustomer,
    });
  } catch (error) {
    console.error("Error deleting customer:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting customer",
      error: error.message,
    });
  }
};

export const addCustomerAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const { label, address_1, address_2, city, state, postal_code, gst_no, site_contact, site_phone, is_shipping } = req.body;

    if (!address_1 || !city) {
      return res.status(400).json({
        success: false,
        message: "Address and city are required",
      });
    }

    // Try finding customer by custom id (nanoid) or MongoDB _id
    let customer = await customerModel.findOne({ id });
    if (!customer && mongoose.Types.ObjectId.isValid(id)) {
      customer = await customerModel.findById(id);
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const newAddress = {
      label: label || `${city} Office`,
      address_1,
      address_2: address_2 || "",
      city,
      state: state || customer.address?.[0]?.state || "Maharashtra",
      postal_code: postal_code || customer.address?.[0]?.postal_code || "400001",
      gst_no: gst_no || customer.address?.[0]?.gst_no || "",
      is_billing: false,
      is_shipping: is_shipping !== undefined ? is_shipping : true,
      site_contact: site_contact || "",
      site_phone: site_phone || "",
    };

    customer.address.push(newAddress);
    customer.updated_at = getCurrentDate();
    await customer.save();

    const savedAddress = customer.address[customer.address.length - 1];

    return res.status(200).json({
      success: true,
      message: "Address added successfully to customer master",
      data: customer,
      newAddress: savedAddress,
    });
  } catch (error) {
    console.error("Error adding customer address:", error);
    return res.status(500).json({
      success: false,
      message: "Error adding customer address",
      error: error.message,
    });
  }
};

export const addCustomerContact = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, mobile_no, email, is_primary } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Contact name is required",
      });
    }

    // Try finding customer by custom id (nanoid) or MongoDB _id
    let customer = await customerModel.findOne({ id });
    if (!customer && mongoose.Types.ObjectId.isValid(id)) {
      customer = await customerModel.findById(id);
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const newContact = {
      name: name.trim(),
      role: (role || "Contact").trim(),
      mobile_no: mobile_no ? String(mobile_no).trim() : "",
      email: email ? String(email).trim() : "",
      is_primary: Boolean(is_primary),
    };

    if (!Array.isArray(customer.contacts)) {
      customer.contacts = [];
    }
    if (!Array.isArray(customer.additional_contacts)) {
      customer.additional_contacts = [];
    }

    const cIdx = customer.contacts.findIndex(
      (c) => c.name?.trim().toLowerCase() === newContact.name.toLowerCase()
    );
    if (cIdx >= 0) {
      customer.contacts[cIdx] = { ...customer.contacts[cIdx].toObject?.() || customer.contacts[cIdx], ...newContact };
    } else {
      customer.contacts.push(newContact);
    }

    const acIdx = customer.additional_contacts.findIndex(
      (c) => c.name?.trim().toLowerCase() === newContact.name.toLowerCase()
    );
    if (acIdx >= 0) {
      customer.additional_contacts[acIdx] = { ...customer.additional_contacts[acIdx].toObject?.() || customer.additional_contacts[acIdx], ...newContact };
    } else {
      customer.additional_contacts.push(newContact);
    }

    // If customer has no contact_person or it was empty, set this new contact as primary
    if (!customer.contact_person || customer.contact_person === "Primary Contact") {
      customer.contact_person = newContact.name;
      if (newContact.mobile_no) {
        customer.mobile_no = Number(String(newContact.mobile_no).replace(/\D/g, "")) || customer.mobile_no;
      }
      if (newContact.email) {
        customer.email = newContact.email;
      }
    }

    customer.updated_at = getCurrentDate();
    await customer.save();

    const savedContact = customer.contacts.find(
      (c) => c.name?.trim().toLowerCase() === newContact.name.toLowerCase()
    ) || customer.contacts[customer.contacts.length - 1];

    return res.status(200).json({
      success: true,
      message: "Contact added successfully to customer master",
      data: customer,
      newContact: savedContact,
    });
  } catch (error) {
    console.error("Error adding customer contact:", error);
    return res.status(500).json({
      success: false,
      message: "Error adding customer contact",
      error: error.message,
    });
  }
};


