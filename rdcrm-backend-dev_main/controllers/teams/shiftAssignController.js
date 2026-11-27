// controllers/shiftRosterController.js
import User from '../../models/users/userModel.js';
import Department from '../../models/masters/departmentModel.js';
import ShiftTime from '../../models/masters/shiftTimeModel.js';
import ShiftAssignment from '../../models/teams/shiftAssignModel.js';
import { getCurrentDate } from "../../helpers/dateTime.js";

export const bulkAssignShift = async (req, res) => {
    try {
        const { department_id, shift_time_id, remarks, user_ids } = req.body;

        // Validation
        if (!department_id || !shift_time_id || !user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'department_id, shift_time_id, and user_ids are required'
            });
        }

       const assigned_by = req.user._id;

        // Verify department and shift exist
        const [department, shiftTime, users] = await Promise.all([
            Department.findById(department_id),
            ShiftTime.findById(shift_time_id),
            User.find({ _id: { $in: user_ids }, is_active: true })
        ]);

        if (!department) {
            return res.status(404).json({ 
                success: false, 
                message: 'Department not found' 
            });
        }

        if (!shiftTime) {
            return res.status(404).json({ 
                success: false, 
                message: 'Shift time not found' 
            });
        }

        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'No active users found' 
            });
        }

        // Deactivate previous assignments for these users
        await ShiftAssignment.updateMany(
            { 
                user_id: { $in: user_ids },
                is_active: true 
            },
            { 
                $set: { is_active: false } 
            }
        );

        // Create new shift assignments
        const assignments = user_ids.map(user_id => ({
            user_id,
            department_id,
            shift_time_id,
            remarks: remarks?.trim() || "",
            assigned_by,
            is_active: true,
            created_at: getCurrentDate()
        }));

        const createdAssignments = await ShiftAssignment.insertMany(assignments);

        res.status(201).json({
            success: true,
            message: `Shift assigned to ${createdAssignments.length} user(s)`,
            data: {
                assignedCount: createdAssignments.length,
                department: department.name,
                shift: `${shiftTime.start_time} - ${shiftTime.end_time} (${shiftTime.name})`,
                remarks: remarks || ""
            },
        });
    } catch (error) {
        console.error('Bulk assign shift error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign shifts',
            error: error.message
        });
    }
};


export const getShiftRosterOverview = async (req, res) => {
    try {
        const { department_id, shift_time_id } = req.query;
        
        // Build filter for users
        const userFilter = { is_active: true };
        if (department_id) {
            userFilter.department_id = department_id;
        }

        // Build filter for assignments
        const assignmentFilter = { is_active: true };
        if (shift_time_id) {
            assignmentFilter.shift_time_id = shift_time_id;
        }

        // Get users based on filter
        const users = await User.find(userFilter)
            .populate('department_id', 'id name')
            .select('id emp_id name email phone_number department_id')
            .sort({ emp_id: 1 })
            .lean();

        if (users.length === 0) {
            return res.status(200).json({
                success: true,
                count: 0,
                data: []
            });
        }

        const userIds = users.map(u => u._id);

        // Get latest active assignments for these users
        const assignments = await ShiftAssignment.find({
            user_id: { $in: userIds },
            is_active: true
        })
            .populate('shift_time_id', 'id name start_time end_time')
            .populate('department_id', 'id name')
            .populate('assigned_by', 'id name emp_id')
            .lean();

        // Create a map of user_id to assignment
        const assignmentMap = new Map();
        assignments.forEach(assignment => {
            assignmentMap.set(assignment.user_id.toString(), assignment);
        });

        // Combine user data with assignment data
        const overview = users.map(user => {
            const assignment = assignmentMap.get(user._id.toString());

            return {
                _id: user._id,
                id: user.id,
                emp_id: user.emp_id,
                name: user.name,
                email: user.email,
                phone_number: user.phone_number,
                department: user.department_id,
                current_shift_time: assignment?.shift_time_id || null,
                remarks: assignment?.remarks || "",
                assigned_by: assignment?.assigned_by || null,
                assigned_at: assignment?.created_at || null,
                assignment_id: assignment?.id || null,
            };
        });

        res.status(200).json({
            success: true,
            count: overview.length,
            data: overview,
        });
    } catch (error) {
        console.error('Get roster overview error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch roster overview',
            error: error.message
        });
    }
};


export const viewUserShiftDetails = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId)
            .populate('department_id', 'id name')
            .select('id emp_id name email phone_number department_id')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get current active assignment
        const currentAssignment = await ShiftAssignment.findOne({
            user_id: userId,
            is_active: true
        })
            .populate('shift_time_id', 'id name start_time end_time')
            .populate('department_id', 'id name')
            .populate('assigned_by', 'id name emp_id')
            .lean();

        // Get all assignment history (sorted by most recent first)
        const assignmentHistory = await ShiftAssignment.find({
            user_id: userId
        })
            .populate('shift_time_id', 'id name start_time end_time')
            .populate('department_id', 'id name')
            .populate('assigned_by', 'id name emp_id')
            .sort({ createdAt: -1 })
            .lean();

        const response = {
            id: user.id,
            emp_id: user.emp_id,
            name: user.name,
            email: user.email,
            phone_number: user.phone_number,
            department: user.department_id,
            current_shift: currentAssignment?.shift_time_id || null,
            assignment_history: assignmentHistory.map(assignment => ({
                assignment_id: assignment.id,
                shift_time: assignment.shift_time_id,
                department: assignment.department_id,
                remarks: assignment.remarks,
                assigned_by: assignment.assigned_by,
                assigned_at: assignment.created_at,
                is_active: assignment.is_active,
            })),
        };

        res.status(200).json({
            success: true,
            data: response,
        });
    } catch (error) {
        console.error('View user shift details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user shift details',
            error: error.message
        });
    }
};

export const getShiftAssignmentHistory = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId)
            .select('id emp_id name')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const [history, totalCount] = await Promise.all([
            ShiftAssignment.find({ user_id: userId })
                .populate('shift_time_id', 'id name start_time end_time')
                .populate('department_id', 'id name')
                .populate('assigned_by', 'id name emp_id')
                .sort({ createdAt: -1 })
                .lean(),
            ShiftAssignment.countDocuments({ user_id: userId })
        ]);

        res.status(200).json({
            success: true,
            count: history.length,
            totalCount,
            data: {
                user: {
                    id: user.id,
                    emp_id: user.emp_id,
                    name: user.name
                },
                history: history.map(assignment => ({
                    assignment_id: assignment.id,
                    shift_time: assignment.shift_time_id,
                    department: assignment.department_id,
                    remarks: assignment.remarks,
                    assigned_by: assignment.assigned_by,
                    assigned_at: assignment.createdAt,
                    is_active: assignment.is_active,
                }))
            },
        });
    } catch (error) {
        console.error('Get shift assignment history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch shift assignment history',
            error: error.message
        });
    }
};

export const getUsersForTeamBuilder = async (req, res) => {
    try {
        const { department_id, shift_time_id } = req.query;

        const userFilter = {
            is_active: true,
            team_id: null, // Users not assigned to any team
        };

        if (department_id) {
            userFilter.department_id = department_id;
        }

        const users = await User.find(userFilter)
            .select('id name emp_id department_id image')
            .populate('department_id', 'id name')
            .sort({ emp_id: 1 })
            .lean();

        if (users.length === 0) {
            return res.status(200).json({
                success: true,
                count: 0,
                data: []
            });
        }

        // If shift_time_id filter is provided, get only users with that shift
        if (shift_time_id) {
            const userIds = users.map(u => u._id);
            
            const assignments = await ShiftAssignment.find({
                user_id: { $in: userIds },
                shift_time_id: shift_time_id,
                is_active: true
            })
                .select('user_id')
                .lean();

            const filteredUserIds = new Set(assignments.map(a => a.user_id.toString()));
            
            const filteredUsers = users.filter(user => 
                filteredUserIds.has(user._id.toString())
            );

            // Get current shift for filtered users
            const currentAssignments = await ShiftAssignment.find({
                user_id: { $in: filteredUsers.map(u => u._id) },
                is_active: true
            })
                .populate('shift_time_id', 'id name start_time end_time')
                .lean();

            const assignmentMap = new Map();
            currentAssignments.forEach(assignment => {
                assignmentMap.set(assignment.user_id.toString(), assignment.shift_time_id);
            });

            const result = filteredUsers.map(user => ({
                ...user,
                current_shift_time: assignmentMap.get(user._id.toString()) || null
            }));

            return res.status(200).json({
                success: true,
                count: result.length,
                data: result,
            });
        }

        // Get current shift for all users
        const userIds = users.map(u => u._id);
        const currentAssignments = await ShiftAssignment.find({
            user_id: { $in: userIds },
            is_active: true
        })
            .populate('shift_time_id', 'id name start_time end_time')
            .lean();

        const assignmentMap = new Map();
        currentAssignments.forEach(assignment => {
            assignmentMap.set(assignment.user_id.toString(), assignment.shift_time_id);
        });

        const result = users.map(user => ({
            ...user,
            current_shift_time: assignmentMap.get(user._id.toString()) || null
        }));

        res.status(200).json({
            success: true,
            count: result.length,
            data: result,
        });
    } catch (error) {
        console.error('Get users for team builder error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users',
            error: error.message
        });
    }
};


export const updateShiftAssignment = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const { remarks, shift_time_id } = req.body;

        const assignment = await ShiftAssignment.findOne({ 
            id: assignmentId,
            is_active: true 
        });

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found or already inactive'
            });
        }

        const updateData = {};
        if (remarks !== undefined) updateData.remarks = remarks.trim();
        if (shift_time_id) {
            const shiftTime = await ShiftTime.findById(shift_time_id);
            if (!shiftTime) {
                return res.status(404).json({
                    success: false,
                    message: 'Shift time not found'
                });
            }
            updateData.shift_time_id = shift_time_id;
        }

        const updatedAssignment = await ShiftAssignment.findByIdAndUpdate(
            assignment._id,
            { $set: updateData },
            { new: true }
        )
            .populate('shift_time_id', 'id name start_time end_time')
            .populate('department_id', 'id name')
            .populate('assigned_by', 'id name emp_id');

        res.status(200).json({
            success: true,
            message: 'Assignment updated successfully',
            data: updatedAssignment,
        });
    } catch (error) {
        console.error('Update shift assignment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update assignment',
            error: error.message
        });
    }
};

export const deactivateShiftAssignment = async (req, res) => {
    try {
        const { assignmentId } = req.params;

        const assignment = await ShiftAssignment.findOneAndUpdate(
            { id: assignmentId, is_active: true },
            { $set: { is_active: false } },
            { new: true }
        );

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found or already inactive'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Assignment deactivated successfully',
            data: assignment,
        });
    } catch (error) {
        console.error('Deactivate shift assignment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to deactivate assignment',
            error: error.message
        });
    }
};

export const getDepartmentShiftSummary = async (req, res) => {
    try {
        const { departmentId } = req.params;

        const department = await Department.findById(departmentId);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        // Get all active users in the department
        const users = await User.find({
            department_id: departmentId,
            is_active: true
        }).select('_id');

        const userIds = users.map(u => u._id);

        // Get active assignments for these users
        const assignments = await ShiftAssignment.aggregate([
            {
                $match: {
                    user_id: { $in: userIds },
                    is_active: true
                }
            },
            {
                $lookup: {
                    from: 'shift_times',
                    localField: 'shift_time_id',
                    foreignField: '_id',
                    as: 'shift_time'
                }
            },
            {
                $unwind: '$shift_time'
            },
            {
                $group: {
                    _id: '$shift_time_id',
                    shift_name: { $first: '$shift_time.name' },
                    start_time: { $first: '$shift_time.start_time' },
                    end_time: { $first: '$shift_time.end_time' },
                    employee_count: { $sum: 1 }
                }
            },
            {
                $sort: { start_time: 1 }
            }
        ]);

        const totalAssigned = assignments.reduce((sum, shift) => sum + shift.employee_count, 0);
        const unassigned = users.length - totalAssigned;

        res.status(200).json({
            success: true,
            data: {
                department: {
                    id: department.id,
                    name: department.name
                },
                total_employees: users.length,
                total_assigned: totalAssigned,
                unassigned: unassigned,
                shift_distribution: assignments.map(shift => ({
                    shift_id: shift._id,
                    shift_name: shift.shift_name,
                    shift_time: `${shift.start_time} - ${shift.end_time}`,
                    employee_count: shift.employee_count
                }))
            }
        });
    } catch (error) {
        console.error('Get department shift summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch department summary',
            error: error.message
        });
    }
};