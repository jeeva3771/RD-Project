import userModel from "../../../models/users/userModel.js";
import roleModel from "../../../models/masters/roleModel.js";
import departmentModel from "../../../models/masters/departmentModel.js";
import EnquiryJob from "../../../models/enquiry/enquiryJobIntegrationModel.js";

// ==========================================
// MASTER DATA CONTROLLERS (COORDINATORS & DESIGNERS)
// ==========================================

export const getCoordinators = async (req, res) => {
  try {
    const csDepts = await departmentModel.find({ name: /client servicing/i }).select("_id");
    const deptIds = csDepts.map((d) => d._id);

    const csRoles = await roleModel.find({ name: /client servicing/i }).select("_id name");
    const roleIds = csRoles.map((r) => r._id);
    const roleMap = csRoles.reduce((acc, r) => {
      acc[String(r._id)] = r.name;
      return acc;
    }, {});

    let users = await userModel
      .find({
        is_active: true,
        $or: [
          { department_id: { $in: deptIds } },
          { role: { $in: roleIds } },
          { name: /client servicing/i },
        ],
      })
      .populate("role", "name")
      .select("id name username email role department_id")
      .lean();

    if (!users || users.length === 0) {
      users = await userModel.find({ is_active: true }).limit(5).populate("role", "name").lean();
    }

    const loadMap = {};
    try {
      const openEnquiriesByUser = await EnquiryJob.aggregate([
        { $match: { stage: { $in: ["enquiry", "brief", "sample", "production"] }, is_lost: { $ne: true } } },
        { $group: { _id: "$coordinator_name", count: { $sum: 1 } } },
      ]);
      openEnquiriesByUser.forEach((item) => {
        if (item._id) loadMap[item._id] = item.count;
      });
    } catch (aggErr) {
      console.warn("Could not aggregate coordinator workload:", aggErr.message);
    }

    const coordinators = users.map((u) => {
      const roleName = u.role?.name || roleMap[String(u.role)] || "Client Servicing";
      const openCount = loadMap[u.name] || 0;
      return {
        id: u.id || String(u._id),
        _id: String(u._id),
        name: u.name,
        username: u.username,
        role: roleName,
        is_manager: /manager/i.test(roleName),
        is_executive: /executive/i.test(roleName),
        open_enquiries: openCount,
      };
    });

    res.status(200).json({
      success: true,
      data: coordinators,
    });
  } catch (error) {
    console.error("Error fetching coordinators (integration):", error);
    res.status(500).json({
      success: false,
      message: "Error fetching coordinators",
      error: error.message,
    });
  }
};

// 11. Get all Active Designers for assignment belonging to the 3 designated design roles:
// "3D Design Executive", "Design Executive", "Design Head"
export const getDesigners = async (req, res) => {
  try {
    const targetRoles = [
      "3D Design Executive",
      "Design Executive",
      "Design Head"
    ];

    const roleRegexPatterns = targetRoles.map(
      (r) => new RegExp(`^${r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
    );

    const matchingRoles = await roleModel
      .find({ name: { $in: roleRegexPatterns } })
      .select("_id name")
      .lean();

    const roleIds = matchingRoles.map((r) => r._id);
    const roleMap = matchingRoles.reduce((acc, r) => {
      acc[String(r._id)] = r.name;
      return acc;
    }, {});

    let users = await userModel
      .find({
        is_active: true,
        role: { $in: roleIds },
      })
      .populate("role", "name")
      .select("id name username email role department_id")
      .sort({ name: 1 })
      .lean();

    if (!users || users.length === 0) {
      users = await userModel
        .find({
          is_active: { $ne: false },
          role: { $in: roleIds },
        })
        .populate("role", "name")
        .select("id name username email role department_id")
        .sort({ name: 1 })
        .lean();
    }

    if (!users || users.length === 0) {
      const anyDesignRoles = await roleModel.find({ name: /design/i }).select("_id name").lean();
      const anyRoleIds = anyDesignRoles.map((r) => r._id);
      anyDesignRoles.forEach((r) => { roleMap[String(r._id)] = r.name; });
      const designDepts = await departmentModel.find({ name: /design/i }).select("_id");
      const designDeptIds = designDepts.map((d) => d._id);
      users = await userModel
        .find({
          is_active: { $ne: false },
          $or: [
            { role: { $in: anyRoleIds } },
            { department_id: { $in: designDeptIds } },
          ],
        })
        .populate("role", "name")
        .select("id name username email role department_id")
        .sort({ name: 1 })
        .lean();
    }

    const loadMap = {};
    try {
      const openDesignsByUser = await EnquiryJob.aggregate([
        {
          $match: {
            "the_brief.designer_id": { $exists: true },
            stage: { $in: ["enquiry", "brief"] },
            is_lost: { $ne: true },
          },
        },
        { $group: { _id: "$the_brief.designer_name", count: { $sum: 1 } } },
      ]);
      openDesignsByUser.forEach((item) => {
        if (item._id) loadMap[item._id] = item.count;
      });
    } catch (aggErr) {
      console.warn("Could not aggregate designer workload:", aggErr.message);
    }

    const designers = users.map((u) => {
      const roleName = u.role?.name || roleMap[String(u.role)] || "Design Executive";
      return {
        id: u.id || String(u._id),
        _id: String(u._id),
        name: u.name,
        username: u.username,
        role: roleName,
        open_designs: loadMap[u.name] || 0,
      };
    });

    res.status(200).json({
      success: true,
      data: designers,
    });
  } catch (error) {
    console.error("Error fetching designers:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching designers",
      error: error.message,
    });
  }
};

// 12. Get enquiries assigned to the logged-in designer