import { nanoid } from "nanoid";
import roleModel from "../../models/masters/roleModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import userModel from "../../models/users/userModel.js";
import { escapeRegex } from "../../helpers/escapeRegex.js";

export const getAllRoles = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit)));
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";

    const query = {};

    // Search filter
    if (search) {
      const safeSearch = escapeRegex(search);
      query.name = { $regex: safeSearch, $options: "i" };
    }
    

    if (typeof req.query.is_active !== "undefined") {
      if (req.query.is_active === "true") {
        query.is_active = true;
      } else if (req.query.is_active === "false") {
        query.is_active = false;
      }
    }

    const totalRoles = await roleModel.countDocuments(query);

    const roles = await roleModel
      .find(query)
      .populate("created_by")
      .populate("updated_by.user")
      .sort({ createdAt: -1 }) 
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalRoles / limit);

    res.status(200).json({
      success: true,
      count: roles.length,
      total: totalRoles,
      page,
      totalPages,
      data: roles,
    });
  } catch (error) {
    console.error("Error getting roles:", error);
    res.status(500).json({
      success: false,
      message: "Error getting roles",
      error: error.message,
    });
  }
};

export const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await roleModel
      .findOne({ id })
      .populate("created_by")
      .populate("updated_by.user");

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error("Error getting role:", error);
    res.status(500).json({
      success: false,
      message: "Error getting role",
      error: error.message,
    });
  }
};

export const createRole = async (req, res) => {
  try {
    const { name, permission, is_active } = req.body;

    if (!name || !permission) {
      return res.status(400).json({
        success: false,
        message: "Role name is required",
      });
    }

    const existingRole = await roleModel.findOne({ name });
    if (existingRole) {
      return res.status(409).json({
        success: false,
        message: "Role name already exists",
      });
    }

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID not found",
      });
    }

    const newRole = new roleModel({
      id: nanoid(16),
      name,
      permission: permission ?? [],
      is_active: is_active ?? true,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
    });

    const savedRole = await newRole.save();

    res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: savedRole,
    });
  } catch (error) {
    console.error("Error creating role:", error);
    res.status(500).json({
      success: false,
      message: "Error creating role",
      error: error.message,
    });
  }
};

export const updateRole = async (req, res) => {
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

    const role = await roleModel.findOne({ id });
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    if (updateData.name && updateData.name !== role.name) {
      const nameExists = await roleModel.findOne({ name: updateData.name });
      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: "Role name already in use",
        });
      }
    }

    const otherUpdates = { ...updateData };
    delete otherUpdates.updated_by;

    await roleModel.updateOne(
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

    const updatedRole = await roleModel
      .findOne({ id })
      .populate("created_by")
      .populate("updated_by.user");

    res.status(200).json({
      success: true,
      message: "Role updated successfully",
      data: updatedRole,
    });
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({
      success: false,
      message: "Error updating role",
      error: error.message,
    });
  }
};

export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;


         const RoleToDelete = await roleModel.findOne({ id });
        
            if (!RoleToDelete) {
              return res.status(404).json({
                success: false,
                message: "Role not found",
              });
            }
        
      

       const isroleInUse = await userModel.findOne({
          role: RoleToDelete._id,
        });

      if (isroleInUse) {
      return res.status(400).json({
        success: false,
        message: "Role cannot be deleted because it is in use by a user.",
      });
    }

    const deletedRole = await roleModel.findOneAndDelete({ id });


    res.status(200).json({
      success: true,
      message: "Role deleted successfully",
      data: deletedRole,
    });
  } catch (error) {
    console.error("Error deleting role:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting role",
      error: error.message,
    });
  }
};
