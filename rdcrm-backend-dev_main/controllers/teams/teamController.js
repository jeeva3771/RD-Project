import Team from "../../models/teams/teamModel.js";
import assemblyTeamModel from "../../models/teams/assemblyTeamModel.js";
import User from "../../models/users/userModel.js";
import moment from "moment";
import { generateSignedUrl } from "../../helpers/r2helper.js";

// Create Team
export const createTeam = async (req, res) => {
    try {
        const { team_name, shift_timing, department_id, member_list, is_active, type } =
            req.body;

        // Validation
        if (!team_name || !department_id) {
            return res.status(400).json({
                success: false,
                message: "Team name and Department are required",
            });
        }

        // Prevent stranding active jobs on empty teams
        if (member_list && member_list.length > 0) {
            const affectedTeams = await Team.find({
                member_list: { $in: member_list },
                is_active: true
            });
            for (const t of affectedTeams) {
                const remainingMembers = t.member_list.filter(m => !member_list.includes(m.toString()));
                if (remainingMembers.length === 0) {
                    const activeJobs = await assemblyTeamModel.countDocuments({ team_id: t._id });
                    if (activeJobs > 0) {
                        return res.status(400).json({
                            success: false,
                            message: `Cannot transfer members from '${t.team_name}'. They are the last members and '${t.team_name}' currently has active jobs assigned. Reassign the jobs first.`,
                        });
                    }
                }
            }
        }

        // Generate Code
        // 1. Get first 3 letters of team name
        const prefix = team_name.substring(0, 3).toUpperCase();

        // 2. Generate unique random 3-digit number
        let isUnique = false;
        let code = "";

        // Loop until unique
        // Safety break after 50 attempts to prevent infinite loop if namespace full (unlikely with 900 numbers)
        for (let i = 0; i < 50; i++) {
            const randomNum = Math.floor(100 + Math.random() * 900); // 100-999
            code = `${prefix}-${randomNum}`;

            const existing = await Team.findOne({ code });
            if (!existing) {
                isUnique = true;
                break;
            }
        }

        if (!isUnique) {
            return res.status(409).json({
                success: false,
                message: "Could not generate a unique team code. Please try again or change the team name."
            });
        }

        // Pick a unique color for the team
        const TEAM_PALETTE = [
            '#2563eb', '#4f46e5', '#9333ea', '#db2777', '#e11d48', '#ea580c',
            '#d97706', '#65a30d', '#059669', '#0d9488', '#0891b2', '#0284c7',
            '#7c3aed', '#c026d3', '#be185d', '#dc2626'
        ];

        // Find colors already in use by active teams
        const usedColors = (await Team.find({ is_active: true }).select('color')).map(t => t.color);

        let teamColor = TEAM_PALETTE.find(c => !usedColors.includes(c));

        // If palette is exhausted or we want extra variety, generate a random hex color
        if (!teamColor) {
            const generateRandomColor = () => {
                const letters = '0123456789ABCDEF';
                let color = '#';
                for (let i = 0; i < 6; i++) {
                    color += letters[Math.floor(Math.random() * 16)];
                }
                return color;
            };

            // Try to generate a unique random color (up to 5 attempts)
            for (let i = 0; i < 5; i++) {
                const randomColor = generateRandomColor();
                if (!usedColors.includes(randomColor)) {
                    teamColor = randomColor;
                    break;
                }
                teamColor = randomColor; // Fallback to the last generated
            }
        }

        const newTeam = new Team({
            team_name,
            code,
            shift_timing,
            department_id,
            member_list,
            is_active,
            type,
            color: teamColor,
            created_by: req.user?._id,
            created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        });

        await newTeam.save();

        if (member_list && member_list.length > 0) {
            // Identify which teams are about to have members removed
            const affectedTeams = await Team.find({ _id: { $ne: newTeam._id }, member_list: { $in: member_list } });

            // Remove from existing teams' member_list
            await Team.updateMany(
                { _id: { $ne: newTeam._id }, member_list: { $in: member_list } },
                { $pull: { member_list: { $in: member_list } } }
            );

            // If those teams are now completely empty, set them to inactive
            if (affectedTeams.length > 0) {
                const affectedTeamIds = affectedTeams.map(t => t._id);
                await Team.updateMany(
                    { _id: { $in: affectedTeamIds }, member_list: { $size: 0 } },
                    { $set: { is_active: false } }
                );
            }

            await User.updateMany(
                { _id: { $in: member_list } },
                { $set: { team_id: newTeam._id } }
            );
        }

        res.status(201).json({
            success: true,
            message: "Team created successfully",
            data: newTeam,
        });
    } catch (error) {
        console.error("Error creating team:", error);
        res.status(500).json({
            success: false,
            message: "Error creating team",
            error: error.message,
        });
    }
};

// Get All Teams
export const getAllTeams = async (req, res) => {
    try {
        const { page = 1, limit, department, search, is_active } = req.query;

        const query = {};

        if (department) {
            query.department_id = department;
        }

        if (is_active) {
            query.is_active = is_active === "true";
            if (query.is_active) {
                // Ensure active teams have at least one member
                query['member_list.0'] = { $exists: true };
            }
        }

        if (search) {
            query.team_name = { $regex: search, $options: "i" };
        }

        let teamsQuery = Team.find(query)
            .populate("department_id", "_id id name")
            .populate("member_list", "_id id name emp_id email image")
            .populate("created_by", "name")
            .populate("shift_timing", "_id name start_time end_time")
            .sort({ createdAt: -1 });

        if (limit) {
            teamsQuery = teamsQuery.limit(limit * 1).skip((page - 1) * limit);
        }

        const teams = await teamsQuery;

        const count = await Team.countDocuments(query);

        const signedTeams = await Promise.all(teams.map(async (t) => {
            const tObj = t.toObject ? t.toObject() : t;
            if (tObj.member_list) {
                tObj.member_list = await Promise.all(tObj.member_list.map(async (m) => {
                    if (m.image) m.image = await generateSignedUrl(m.image);
                    return m;
                }));
            }
            return tObj;
        }));

        res.status(200).json({
            success: true,
            message: "Teams fetched successfully",
            data: signedTeams,
            total: count,
            totalPages: limit ? Math.ceil(count / limit) : 1,
            currentPage: parseInt(page),
            limit: limit ? parseInt(limit) : count,
        });
    } catch (error) {
        console.error("Error fetching teams:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching teams",
            error: error.message,
        });
    }
};

// Get Team by ID
export const getTeamById = async (req, res) => {
    try {
        const { id } = req.params;
        const team = await Team.findOne({ id })
            .populate("department_id", "_id name")
            .populate("member_list", "_id name emp_id email image")
            .populate("shift_timing", "_id name start_time end_time");

        if (team) {
            const tObj = team.toObject();
            if (tObj.member_list) {
                tObj.member_list = await Promise.all(tObj.member_list.map(async (m) => {
                    if (m.image) m.image = await generateSignedUrl(m.image);
                    return m;
                }));
            }
            return res.status(200).json({ success: true, data: tObj });
        }

        if (!team) {
            // if not found by _id, try custom id
            const teamByCustomId = await Team.findOne({ id })
                .populate("department_id", "_id name")
                .populate("member_list", "_id name emp_id email")
                .populate("shift_timing", "_id name start_time end_time");
            if (!teamByCustomId) {
                return res.status(404).json({
                    success: false,
                    message: "Team not found",
                });
            }
            return res.status(200).json({
                success: true,
                data: teamByCustomId
            })
        }

        res.status(200).json({
            success: true,
            data: team,
        });
    } catch (error) {
        console.error("Error fetching team:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching team",
            error: error.message,
        });
    }
};

// Update Team
export const updateTeam = async (req, res) => {
    try {
        const { id } = req.params;
        const { team_name, shift_timing, department_id, member_list, is_active, color } = req.body;

        // Find by _id or custom id
        let team = await Team.findById(id);
        if (!team) {
            team = await Team.findOne({ id: id });
        }

        if (!team) {
            return res.status(404).json({
                success: false,
                message: "Team not found",
            });
        }

        if (team_name) team.team_name = team_name;
        if (shift_timing) team.shift_timing = shift_timing;
        if (department_id) team.department_id = department_id;
        if (member_list) team.member_list = member_list;
        if (typeof is_active !== 'undefined') team.is_active = is_active;
        if (color) team.color = color;

        // Prevent stranding active jobs on empty teams if member list is being changed
        // if (member_list) {
        //     const affectedTeams = await Team.find({
        //         _id: { $ne: team._id }, // Don't check the team we are currently updating
        //         member_list: { $in: member_list },
        //         is_active: true
        //     });
        //     for (const t of affectedTeams) {
        //         const remainingMembers = t.member_list.filter(m => !member_list.includes(m.toString()));
        //         if (remainingMembers.length === 0) {
        //             const activeJobs = await teamProductionJobModel.countDocuments({ team_id: t._id });
        //             if (activeJobs > 0) {
        //                 return res.status(400).json({
        //                     success: false,
        //                     message: `Cannot transfer members from '${t.team_name}'. They are the last members and '${t.team_name}' currently has active jobs assigned. Reassign the jobs first.`,
        //                 });
        //             }
        //         }
        //     }
        // }

        // Add update log
        team.updated_by.push({
            user: req.user?._id,
            date: moment().format("YYYY-MM-DD HH:mm:ss")
        });
        team.updated_at = moment().format("YYYY-MM-DD");

        await team.save();

        res.status(200).json({
            success: true,
            message: "Team updated successfully",
            data: team,
        });
    } catch (error) {
        console.error("Error updating team:", error);
        res.status(500).json({
            success: false,
            message: "Error updating team",
            error: error.message,
        });
    }
};

// Delete Team
export const deleteTeam = async (req, res) => {
    try {
        const { id } = req.params;

        // Find and soft delete (set is_active = false)
        let deletedTeam = await Team.findById(id);

        if (!deletedTeam) {
            deletedTeam = await Team.findOne({ id: id });
        }

        if (!deletedTeam) {
            return res.status(404).json({
                success: false,
                message: "Team not found",
            });
        }

        // Check if team has active jobs assigned
        const activeJobs = await assemblyTeamModel.countDocuments({ team_id: deletedTeam._id, is_active: true });
        if (activeJobs > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete '${deletedTeam.team_name}'. It currently has ${activeJobs} active jobs assigned. Please reassign the jobs first.`
            });
        }

        // Soft delete
        deletedTeam.is_active = false;
        await deletedTeam.save();

        // Remove team_id from associated users
        await User.updateMany(
            { team_id: deletedTeam._id },
            { $set: { team_id: null } }
        );

        res.status(200).json({
            success: true,
            message: "Team deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting team:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting team",
            error: error.message,
        });
    }
};

// Remove Member from Team
export const removeMember = async (req, res) => {
    try {
        const { id } = req.params; // Team ID
        const { userId } = req.body; // User ID to remove

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required",
            });
        }

        // Find the team
        let team = await Team.findById(id);
        if (!team) {
            team = await Team.findOne({ id: id });
        }

        if (!team) {
            return res.status(404).json({
                success: false,
                message: "Team not found",
            });
        }

        // Remove user from team member_list
        team.member_list = team.member_list.filter(member => member.toString() !== userId);
        await team.save();

        // Update user's team_id to null
        await User.findByIdAndUpdate(userId, { team_id: null });

        res.status(200).json({
            success: true,
            message: "Member removed successfully",
            data: team
        });
    } catch (error) {
        console.error("Error removing member:", error);
        res.status(500).json({
            success: false,
            message: "Error removing member",
            error: error.message,
        });
    }
};
