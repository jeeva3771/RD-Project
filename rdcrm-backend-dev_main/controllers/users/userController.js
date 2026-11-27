import { nanoid } from "nanoid";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import userModel from "../../models/users/userModel.js";
import shiftAssignmentModel from "../../models/teams/shiftAssignModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import { hashPassword } from "../../helpers/auth.js";
import { deleteFromR2, generateSignedUrl, uploadToR2 } from "../../helpers/r2helper.js";
import roleModel from "../../models/masters/roleModel.js";
import departmentModel from "../../models/masters/departmentModel.js";
import workModel from "../../models/masters/workModel.js";
import companyModel from "../../models/masters/companyModel.js";
import { escapeRegex } from "../../helpers/escapeRegex.js";
import * as XLSX from "xlsx";

export const getUserCounts = async (req, res) => {
  try {
    const { department_id } = req.query;
    let matchQuery = {};
    if (department_id) {
      matchQuery.department_id = new mongoose.Types.ObjectId(department_id);
    }

    const counts = await userModel.aggregate([
      { $match: matchQuery },
      {
        $facet: {
          all: [{ $count: "count" }],
          active: [{ $match: { is_active: true } }, { $count: "count" }],
          inactive: [{ $match: { is_active: false } }, { $count: "count" }],
          byCompany: [
            {
              $group: {
                _id: "$company_id",
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    const result = {
      all: counts[0].all[0]?.count || 0,
      active: counts[0].active[0]?.count || 0,
      inactive: counts[0].inactive[0]?.count || 0,
      byCompany: counts[0].byCompany.reduce((acc, item) => {
        if (item._id) acc[item._id] = item.count;
        return acc;
      }, {}),
    };

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error getting user counts:", error);
    res.status(500).json({
      success: false,
      message: "Error getting user counts",
      error: error.message,
    });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);
    const skip = page && limit ? (page - 1) * limit : 0;

    const search = req.query.search?.trim() || "";
    let roleName = req.query.roleName;
    if (Array.isArray(roleName)) {
      roleName = roleName.join(',');
    }
    roleName = roleName?.trim() || "";
    const departmentName = req.query.departmentName?.trim() || "";
    const departmentId = req.query.department_id?.trim() || req.query.department?.trim() || "";
    const is_active = req.query.is_active;
    const company_id = req.query.company_id?.trim() || "";
    const available_for_team = req.query.available_for_team === "true";

    const sortField = req.query.sortField?.trim() || "";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    let query = {};

    if (available_for_team) {
      query.team_id = null;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
      ];
    }

    // Search filter
    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { username: { $regex: safeSearch, $options: "i" } },
      ];
    }

    if (roleName && roleName.toLowerCase() !== "production") {
      // let rolesToFind = [roleName];
      // if (roleName.toLowerCase() === "design") {
      //   rolesToFind = ["Design Head", "Designer", "designer"];
      // Support comma-separated role names
      let rolesToFind = roleName.split(',').map(r => r.trim()).filter(Boolean);

      // Special case for design role as per existing logic
      if (rolesToFind.some(r => r.toLowerCase() === "design")) {
        rolesToFind = [...new Set([...rolesToFind, "Design Head", "Design Executive", "3D Design Executive"])];
      }

      // Auto-expand account manager & assistant role aliases
      if (rolesToFind.some(r => /account/i.test(r))) {
        rolesToFind = [...new Set([
          ...rolesToFind,
          "Account Manager",
          "Accounts Manager",
          "Account Assistant",
          "Accounts Assistant",
          "Accountant",
          "Accountant Manager",
          "Accounts Executive",
          "Account Executive",
        ])];
      }

      // Auto-expand client servicing role aliases
      if (rolesToFind.some(r => /client\s*servic/i.test(r))) {
        rolesToFind = [...new Set([
          ...rolesToFind,
          "Client Servicing Manager",
          "Client Service Manager",
          "Client Servicing Executive",
          "Client Service Executive",
          "Client Servicing Head",
          "Client Service Head",
        ])];
      }

      // Case-insensitive role lookup to handle mismatched casing 
      // (e.g. frontend sends "admin executive" but DB stores "Admin Executive")
      const roleRegexPatterns = rolesToFind.map(r => new RegExp(`^${r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
      const matchingRoles = await roleModel.find({
        name: { $in: roleRegexPatterns }
      }).select("_id name");

      const roleIds = matchingRoles.map(role => role._id);
      query.role = { $in: roleIds };
    }

    if (roleName && roleName.toLowerCase() === "production") {
      query.is_pricing_specialist = true;

      const role = await roleModel.findOne({
        name: "Production Team"
      }).select("_id");

      if (role?._id) {
        query.role = role._id;
      }
    }


    if (departmentId) {
      // Assuming valid ObjectId string is passed
      try {
        query.department_id = new mongoose.Types.ObjectId(departmentId);
      } catch {
        // Fallback to string if casing fails, though it should be ObjectId
        query.department_id = departmentId;
      }
    }

    if (departmentName) {
      const matchingDepartments = await departmentModel.find({
        name: { $regex: departmentName, $options: "i" },
      }).select("_id");

      const departmentIds = matchingDepartments.map(dept => dept._id);
      query.department_id = { $in: departmentIds };
    }

    if (is_active !== undefined && is_active !== null && is_active !== "") {
      query.is_active = is_active === "true" || is_active === true;
    }

    if (company_id) {
      try {
        query.company_id = new mongoose.Types.ObjectId(company_id);
      } catch {
        query.company_id = company_id;
      }
    }

    // Filter by shift_time_id if provided
    if (req.query.shift_time_id) {
      const shiftAssignments = await shiftAssignmentModel.find({
        shift_time_id: req.query.shift_time_id,
        is_active: true
      }).select("user_id");

      const userIdsInShift = shiftAssignments.map(sa => sa.user_id);

      // If no users found in this shift, we can return empty result immediately or let it fall through
      if (query._id) {
        // If there's already an _id filter (unlikely here but good practice), we need to intersect
        query._id = { $in: userIdsInShift, $eq: query._id };
      } else {
        query._id = { $in: userIdsInShift };
      }
    }

    const totalUsers = await userModel.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);

    const skipValue = Number(skip);
    const limitValue = Number(limit);

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

      // Join department
      {
        $lookup: {
          from: "departments",
          localField: "department_id",
          foreignField: "_id",
          as: "department_lookup",
        },
      },

      // Join role
      {
        $lookup: {
          from: "roles",
          localField: "role",
          foreignField: "_id",
          as: "role_lookup",
        },
      },
      // Join work
      {
        $lookup: {
          from: "works",
          localField: "work_id",
          foreignField: "_id",
          as: "work_lookup",
        },
      },
      // Join company
      {
        $lookup: {
          from: "companies",
          localField: "company_id",
          foreignField: "_id",
          as: "company_lookup",
        },
      },

      {
        $addFields: {
          department_obj: { $arrayElemAt: ["$department_lookup", 0] },
          role_obj: { $arrayElemAt: ["$role_lookup", 0] },
          work_obj: { $arrayElemAt: ["$work_lookup", 0] },
          company_obj: { $arrayElemAt: ["$company_lookup", 0] }
        }
      },

      {
        $addFields: {
          department_sort_name: "$department_obj.name",
          role_sort_name: "$role_obj.name"
        }
      },

      ...(sortField === "department"
        ? [{
          $sort: {
            department_sort_name: sortOrder,
            createdAt: -1
          }
        }]
        : sortField === "role"
          ? [{
            $sort: {
              role_sort_name: sortOrder,
              createdAt: -1
            }
          }]
          : sortField === "name" || sortField === "username"
            ? [{
              $sort: {
                [sortField]: sortOrder,
                createdAt: -1
              }
            }]
            : sortField === "company"
              ? [{
                $sort: {
                  "company_obj.company_name": sortOrder,
                  createdAt: -1
                }
              }]
              : [{ $sort: { createdAt: -1 } }]),

      {
        $addFields: {
          department_id: "$department_obj",
          role: "$role_obj",
          work_id: "$work_obj",
          company_id: "$company_obj"
        }
      },

      // Pagination AFTER sorting
      ...(skipValue > 0 ? [{ $skip: skipValue }] : []),
      ...(limitValue > 0 ? [{ $limit: limitValue }] : []),

      {
        $unset: [
          "department_lookup",
          "role_lookup",
          "work_lookup",
          "company_lookup",
          "department_obj",
          "role_obj",
          "work_obj",
          "company_obj",
          "department_sort_name",
          "role_sort_name",
          "updated_by_user_ids",
          "updated_by_users",
        ]
      },
    ];

    // Apply collation for case-insensitive sorting
    const users = await userModel.aggregate(pipeline).collation({
      locale: "en",
      strength: 2,
    });


    const usersWithSignedUrls = users.map((user) => {
      let signedImage = null;

      if (user.image && typeof user.image === "string" && user.image.trim()) {
        try {
          signedImage = generateSignedUrl(user.image);
        } catch (err) {
          console.error("Error generating signed URL:", err);
        }
      }

      return {
        ...user,
        image: signedImage,
      };
    });


    res.status(200).json({
      success: true,
      count: users.length,
      total: totalUsers,
      page,
      totalPages,
      data: usersWithSignedUrls,
    });
  } catch (error) {
    console.error("Error getting users:", error);
    res.status(500).json({
      success: false,
      message: "Error getting users",
      error: error.message,
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // const user = await userModel.findById(id);
    const user = await userModel.findOne({ id: id }).populate("created_by").populate("updated_by.user").populate("role").populate("department_id").populate("work_id").populate("company_id");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let signedImage = user.image;
    if (user.image) {
      try {
        signedImage = generateSignedUrl(user.image);
      } catch (err) {
        console.error("Error generating signed URL for image:", user.image, err);
      }
    }

    const userWithSignedUrl = {
      ...user.toObject(),
      image: signedImage,
    };


    res.status(200).json({
      success: true,
      data: userWithSignedUrl,
    });
  } catch (error) {
    console.error("Error getting user:", error);
    res.status(500).json({
      success: false,
      message: "Error getting user",
      error: error.message,
    });
  }
};

export const createUser = async (req, res) => {
  try {
    const {
      name,
      username,
      password,
      department_id,
      notes,
      emp_id,
      reference_name,
      email,
      role,
      is_active,
      doj,
      dob,
      phone_number,
      emergency_number,
      is_head,
      is_pricing_specialist,
      company_id,
      work_id,
      only_profile,
      email_app_password,
    } = req.body;
    console.log("req.body", req.body)


    const userId = req.user?._id;

    // Sanitize optional ObjectId fields
    const sanitizedWorkId = work_id === "" ? null : work_id;
    const sanitizedCompanyId = company_id === "" ? null : company_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const requiredValues = [
      name,
      username,
      password,
      department_id,
      role,
      doj,
      dob,
      phone_number,
      emergency_number,
      emp_id,
      reference_name,
    ];

    if (requiredValues.some(v => !v)) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Role-based validation: Email App Password mandatory for Client Servicing roles
    let isClientServicingRole = false;
    if (role) {
      if (mongoose.Types.ObjectId.isValid(role)) {
        const roleDoc = await roleModel.findById(role).lean();
        if (roleDoc && /client\s*servicing\s*(executive|manager)/i.test(roleDoc.name)) {
          isClientServicingRole = true;
        }
      } else if (/client\s*servicing\s*(executive|manager)/i.test(String(role))) {
        isClientServicingRole = true;
      }
    }

    if (isClientServicingRole && (!email_app_password || !String(email_app_password).trim())) {
      return res.status(400).json({
        success: false,
        message: "Email App Password is required for Client Servicing Executive and Client Servicing Manager roles",
        errors: { email_app_password: "Email App Password is required" },
      });
    }

    const lowerUsername = username?.toLowerCase();
    const existingUsers = await userModel.find({
      $or: [{ username: lowerUsername }, { emp_id }],
    });

    if (existingUsers.length) {
      console.log("Conflict found for user creation:", { username, lowerUsername, emp_id });
      const errors = {};

      if (existingUsers.some(u => u.username?.toLowerCase() === lowerUsername)) {
        errors.username = "Username already exists";
      }
      if (existingUsers.some(u => u.emp_id === emp_id)) {
        errors.emp_id = "Employee ID already exists";
      }

      const message = errors.username || errors.emp_id || "User already exists with this username or Employee ID";

      return res.status(409).json({
        success: false,
        message,
        errors,
      });
    }

    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadToR2("userimages", req.file.buffer, req.file.originalname, req.file.mimetype);
    }

    const hashedPassword = await hashPassword(password);

    const newUser = new userModel({
      id: nanoid(16),
      name,
      username,
      password: hashedPassword,
      department_id,
      emp_id,
      notes,
      email,
      dob,
      reference_name,
      role,
      image: imageUrl,
      uuid: uuidv4(),
      is_active: is_active ?? true,
      doj,
      phone_number,
      emergency_number,
      is_head,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
      is_pricing_specialist,
      company_id: sanitizedCompanyId,
      work_id: sanitizedWorkId,
      only_profile: only_profile === "true" || only_profile === true,
      email_app_password: email_app_password ? String(email_app_password).trim() : "",
    });

    const savedUser = await newUser.save();

    const populatedUser = await userModel.findById(savedUser._id)
      .populate("role")
      .populate("department_id")
      .populate("company_id")
      .populate("work_id");

    let signedImage = populatedUser.image;
    if (populatedUser.image) {
      try {
        signedImage = generateSignedUrl(populatedUser.image);
      } catch (err) {
        console.error("Error generating signed URL for image:", populatedUser.image, err);
      }
    }

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: { ...populatedUser.toObject(), image: signedImage },
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({
      success: false,
      message: "Error creating user",
      error: error.message,
    });
  }
};


export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user?._id;

    // Sanitize optional ObjectId fields
    if (updateData.work_id === "") updateData.work_id = null;
    if (updateData.company_id === "") updateData.company_id = null;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const user = await userModel.findOne({ id: id });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Role-based validation: Email App Password mandatory for Client Servicing roles
    const targetRoleId = updateData.role || user.role;
    let isClientServicingRole = false;
    if (targetRoleId) {
      if (mongoose.Types.ObjectId.isValid(targetRoleId)) {
        const roleDoc = await roleModel.findById(targetRoleId).lean();
        if (roleDoc && /client\s*servicing\s*(executive|manager)/i.test(roleDoc.name)) {
          isClientServicingRole = true;
        }
      } else if (/client\s*servicing\s*(executive|manager)/i.test(String(targetRoleId))) {
        isClientServicingRole = true;
      }
    }

    if (isClientServicingRole) {
      const incomingAppPass = updateData.email_app_password;
      const existingAppPass = user.email_app_password;
      const effectiveAppPass = incomingAppPass !== undefined ? incomingAppPass : existingAppPass;
      if (!effectiveAppPass || !String(effectiveAppPass).trim()) {
        return res.status(400).json({
          success: false,
          message: "Email App Password is required for Client Servicing Executive and Client Servicing Manager roles",
          errors: { email_app_password: "Email App Password is required" },
        });
      }
    }

    if (updateData.email_app_password !== undefined) {
      updateData.email_app_password = String(updateData.email_app_password).trim();
    }

    if (
      (updateData.username && updateData.username !== user.username) ||
      (updateData.emp_id && updateData.emp_id !== user.emp_id)
    ) {
      const lowerUsername = updateData.username?.toLowerCase();
      const existingUser = await userModel.findOne({
        _id: { $ne: user._id }, // exclude current user
        $or: [
          lowerUsername ? { username: lowerUsername } : null,
          updateData.emp_id ? { emp_id: updateData.emp_id } : null,
        ].filter(Boolean),
      });

      if (existingUser) {
        const errors = {};
        const lowerUsername = updateData.username?.toLowerCase();
        const lowerEmpId = updateData.emp_id?.toLowerCase();

        if (lowerUsername && existingUser.username?.toLowerCase() === lowerUsername) {
          errors.username = "Username already in use";
        } else if (lowerEmpId && existingUser.emp_id?.toLowerCase() === lowerEmpId) {
          errors.emp_id = "Employee ID already in use";
        }

        return res.status(409).json({
          success: false,
          message: errors.username || errors.emp_id || "A user with this username or Employee ID already exists",
          errors,
        });
      }
    }


    if (updateData.password) {
      updateData.password = await hashPassword(updateData.password);
    }

    if (updateData.only_profile !== undefined) {
      updateData.only_profile = updateData.only_profile === "true" || updateData.only_profile === true;
    }


    if (req.file) {
      if (user.image) {
        try {
          await deleteFromR2(user.image);
        } catch (err) {
          console.error("Failed to delete image from R2:", user.image, err);
        }
      }
      const newImageUrl = await uploadToR2("userimages", req.file.buffer, req.file.originalname, req.file.mimetype);
      updateData.image = newImageUrl;
    }



    if (updateData.image === "" || updateData.image === null) {
      console.log("Image removal requested");
      console.log("Existing user.image:", user.image);

      if (user.image) {
        try {
          await deleteFromR2(user.image);
          console.log("Successfully deleted image from R2");
        } catch (err) {
          console.error("Error deleting image from R2:", err);
        }
      }

      updateData.image = null;
    }



    const otherUpdates = { ...updateData };
    delete otherUpdates.updated_by;

    // await userModel.updateOne(
    //   { id: id },
    //   {
    //     $set: {
    //       ...otherUpdates,
    //       updated_at: getCurrentDate(),
    //     },
    //     $push: {
    //       updated_by: {
    //         user: userId,
    //         date: getCurrentDate(),
    //       },
    //     },
    //   }
    // );
    await userModel.updateOne(
      { id: id },
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


    const updatedUser = await userModel.findOne({ id: id })
      .populate("role")
      .populate("department_id")
      .populate("company_id")
      .populate("work_id");

    let signedImage = updatedUser.image;
    if (updatedUser.image) {
      try {
        signedImage = generateSignedUrl(updatedUser.image);
      } catch (err) {
        console.error("Error generating signed URL for image:", updatedUser.image, err);
      }
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: { ...updatedUser.toObject(), image: signedImage },
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user",
      error: error.message,
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await userModel.findOne({ id: id });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.image) {
      try {
        await deleteFromR2(user.image);
      } catch (err) {
        console.error("Failed to delete image from R2:", user.image, err);
      }
    }

    await userModel.deleteOne({ id: id });

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message,
    });
  }
};

export const bulkUploadUsers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const datasheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(datasheet, { cellDates: true });

    if (!data || data.length === 0) {
      return res.status(400).json({ success: false, message: "Excel file is empty" });
    }

    const currentUserId = req.user?._id;
    const results = {
      total: data.length,
      success: 0,
      failed: 0,
      errors: [],
    };

    // Pre-fetch all roles, departments, works and companies for mapping
    const [roles, departments, works, companies] = await Promise.all([
      roleModel.find({}).lean(),
      departmentModel.find({}).lean(),
      workModel.find({}).lean(),
      companyModel.find({}).lean(),
    ]);

    const roleMap = {};
    roles.forEach(r => { roleMap[r.name.toLowerCase().trim()] = r._id; });

    const deptMap = {};
    departments.forEach(d => { deptMap[d.name.toLowerCase().trim()] = d._id; });

    const workMap = {};
    works.forEach(w => { workMap[w.work_name.toLowerCase().trim()] = w._id; });

    const companyMap = {};
    companies.forEach(c => { companyMap[c.company_name.toLowerCase().trim()] = c._id; });

    for (const [index, row] of data.entries()) {
      try {
        const workName = row["Work"]?.toString().trim().toLowerCase();
        const companyName = row["Company"]?.toString().trim().toLowerCase();
        const name = row["Name"]?.toString().trim();
        const username = row["Username"]?.toString().trim();
        const password = row["Password"]?.toString().trim();
        const emp_id = row["Employee ID"]?.toString().trim();
        const rawEmail = row["Email"]?.toString().trim();
        const email = (rawEmail && rawEmail.includes('@')) ? rawEmail : null;
        const phone_number = (row["Phone No"] || row["Phone No."])?.toString().replace(/\D/g, '').trim();
        const emergency_number = (row["Emergency no."] || row["Emergency no"])?.toString().replace(/\D/g, '').trim();
        const dobVal = row["DOB"];
        const dojVal = row["DOJ"];
        const departmentName = row["Department"]?.toString().trim().toLowerCase();
        const roleName = row["Role"]?.toString().trim().toLowerCase();
        const isHeadStr = row["Is Head"]?.toString().trim().toLowerCase();
        const isPricingStr = (row["s Pricing Specialist"] || row["Is Pricing Specialist"])?.toString().trim().toLowerCase();
        const reference_name = row["Ref. Name"]?.toString().trim();
        const notes = row["Notes"]?.toString().trim();
        const onlyProfileStr = row["Only Profile"]?.toString().trim().toLowerCase();

        const requiredFields = {
          "Name": name,
          "Username": username,
          "Password": password,
          "Employee ID": emp_id,
          "Role": roleName,
          "Department": departmentName,
          "DOB": dobVal,
          "DOJ": dojVal,
          "Phone No": phone_number,
          "Emergency no.": emergency_number,
          "Ref. Name": reference_name
        };

        const missingFields = Object.entries(requiredFields)
          .filter(([, value]) => !value)
          .map(([key]) => key);

        if (missingFields.length > 0) {
          throw new Error(`Missing mandatory fields: ${missingFields.join(", ")}`);
        }

        const roleId = roleMap[roleName];
        if (!roleId) throw new Error(`Role '${roleName}' not found in master list`);

        const deptId = deptMap[departmentName];
        if (!deptId) throw new Error(`Department '${departmentName}' not found in master list`);

        const workId = workName ? workMap[workName] : null;
        if (workName && !workId) {
          throw new Error(`Work '${workName}' not found in master list`);
        }

        const companyId = companyName ? companyMap[companyName] : null;
        if (companyName && !companyId) {
          throw new Error(`Company '${companyName}' not found in master list`);
        }

        // Check if user exists
        const existing = await userModel.findOne({ $or: [{ username }, { emp_id }] });
        if (existing) {
          throw new Error(`Username or Employee ID already exists`);
        }

        // Format dates as DD-MM-YYYY strings for the model
        const formatDate = (val) => {
          if (!val) return null;
          let date;

          if (val instanceof Date) {
            date = val;
          } else if (typeof val === 'number') {
            // Convert Excel serial date to JS Date
            // Excel dates start from Dec 30, 1899
            date = new Date(Math.round((val - 25569) * 86400 * 1000));
          } else if (typeof val === 'string') {
            // Handle DD/MM/YYYY or DD-MM-YYYY
            const parts = val.split(/[-/]/);
            if (parts.length === 3) {
              const day = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10);
              const year = parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
              date = new Date(year, month - 1, day);
            } else {
              date = new Date(val);
            }
          } else {
            date = new Date(val);
          }

          if (!date || isNaN(date.getTime()) || date.getFullYear() <= 1970) {
            return null;
          }

          const d = String(date.getDate()).padStart(2, '0');
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const y = date.getFullYear();
          return `${d}-${m}-${y}`;
        };

        const dob = formatDate(dobVal);
        const doj = formatDate(dojVal);

        if (!dob || !doj) {
          throw new Error(`Invalid date format for DOB (${dobVal}) or DOJ (${dojVal}). Expected DD/MM/YYYY.`);
        }

        const hashedPassword = await hashPassword(password);

        const newUser = new userModel({
          id: nanoid(16),
          name,
          username,
          password: hashedPassword,
          department_id: deptId,
          emp_id,
          notes,
          email,
          dob,
          reference_name,
          role: roleId,
          uuid: uuidv4(),
          is_active: true,
          doj,
          phone_number,
          emergency_number,
          is_head: isHeadStr === "yes",
          is_pricing_specialist: isPricingStr === "yes",
          work_id: workId,
          company_id: companyId,
          only_profile: onlyProfileStr === "yes" || onlyProfileStr === "true",
          created_by: currentUserId,
          created_at: getCurrentDate(),
          updated_by: [],
          updated_at: null
        });

        await newUser.save();
        results.success++;
      } catch (err) {
        console.error(`Row ${index + 2} failed:`, err.message);
        results.failed++;
        results.errors.push({ row: index + 2, emp_id: row["Employee ID"] || "N/A", message: err.message });
      }
    }

    let mainMessage = "";
    if (results.failed > 0) {
      const errorGroups = {};
      results.errors.forEach(err => {
        if (!errorGroups[err.message]) errorGroups[err.message] = [];
        errorGroups[err.message].push(err.emp_id);
      });

      const errorSummary = Object.entries(errorGroups)
        .map(([msg, ids]) => `${msg} (${ids.join(", ")})`)
        .join("; ");

      mainMessage = `Bulk upload failed for ${results.failed} rows. Errors: ${errorSummary}`;
    } else {
      mainMessage = `Bulk upload completed successfully: ${results.success} users created.`;
    }

    res.status(results.failed > 0 && results.success === 0 ? 400 : 200).json({
      success: results.failed === 0,
      message: mainMessage,
      data: results
    });

  } catch (error) {
    console.error("Bulk upload error:", error);
    res.status(500).json({ success: false, message: "Internal server error during bulk upload" });
  }
};
