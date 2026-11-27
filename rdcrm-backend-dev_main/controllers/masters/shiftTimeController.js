import { nanoid } from "nanoid";
import shiftTimeModel from "../../models/masters/shiftTimeModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";

// Get all shift times
export const getAllShiftTimes = async (req, res) => {
    try {

        const { order, page = 1, limit, search = "" } = req.query;

        // Determine sort order
        let sortOption = {};
        if (order === "asc") {
            sortOption = { name: 1 };
        } else if (order === "desc") {
            sortOption = { name: -1 };
        }

        // Build query object
        const query = { is_active: true };
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { start_time: { $regex: search, $options: "i" } },
                { end_time: { $regex: search, $options: "i" } },
            ];
        }

        const totalCount = await shiftTimeModel.countDocuments(query);

        let shiftTimesQuery = shiftTimeModel
            .find(query)
            .sort(sortOption)
            .select("id name start_time end_time is_active created_by created_at")
            .populate({
                path: "created_by",
                select: "name",
            });

        let pageNumber = 1;
        let limitNumber = totalCount || 10;

        if (limit) {
            pageNumber = parseInt(page);
            limitNumber = parseInt(limit);
            const skip = (pageNumber - 1) * limitNumber;
            shiftTimesQuery = shiftTimesQuery.skip(skip).limit(limitNumber);
        }

        const shiftTimes = await shiftTimesQuery;

        res.status(200).json({
            success: true,
            count: shiftTimes.length,
            totalCount,
            totalPages: limit ? Math.ceil(totalCount / limitNumber) : 1,
            currentPage: pageNumber,
            data: shiftTimes,
        });
    } catch (error) {
        console.error("Error getting shift times:", error);
        res.status(500).json({
            success: false,
            message: "Error getting shift times",
            error: error.message,
        });
    }
};

// Create new shift time
export const createShiftTime = async (req, res) => {
    try {
        const userId = req.user?._id;

        const { name, start_time, end_time, is_active } = req.body;
        if (!name || !start_time || !end_time)
            return res
                .status(400)
                .json({ success: false, message: "Missing required fields" });

        const existing = await shiftTimeModel.findOne({
            name: { $regex: `^${name}$`, $options: "i" },
        });
        if (existing)
            return res.status(409).json({
                success: false,
                message: "Shift time name already exists",
            });

        const newShiftTime = new shiftTimeModel({
            id: nanoid(7),
            name,
            start_time,
            end_time,
            is_active: is_active ?? true,
            created_by: userId,
            created_at: getCurrentDate(),
        });

        const savedShiftTime = await newShiftTime.save();

        res.status(201).json({
            success: true,
            message: "Shift time created successfully",
            data: savedShiftTime,
        });
    } catch (error) {
        console.error("Error creating shift time:", error);
        res.status(500).json({
            success: false,
            message: "Error creating shift time",
            error: error.message,
        });
    }
};

// Update shift time
export const updateShiftTime = async (req, res) => {
    try {
        const userId = req.user?._id;

        const { id } = req.params;
        const { name, start_time, end_time, is_active } = req.body;

        const shiftTime = await shiftTimeModel.findOne({ id });
        if (!shiftTime)
            return res
                .status(404)
                .json({ success: false, message: "Shift time not found" });

        if (name && name !== shiftTime.name) {
            const exists = await shiftTimeModel.findOne({
                name: { $regex: `^${name}$`, $options: "i" },
            });
            if (exists && exists.id !== id)
                return res.status(409).json({
                    success: false,
                    message: "Shift time name already exists",
                });
        }

        shiftTime.name = name ?? shiftTime.name;
        shiftTime.start_time = start_time ?? shiftTime.start_time;
        shiftTime.end_time = end_time ?? shiftTime.end_time;
        shiftTime.is_active =
            typeof is_active === "boolean" ? is_active : shiftTime.is_active;

        // Add to updated_by array
        shiftTime.updated_by.push({
            user: userId,
            date: getCurrentDate()
        });

        const updatedShiftTime = await shiftTime.save();

        res.status(200).json({
            success: true,
            message: "Shift time updated successfully",
            data: updatedShiftTime,
        });
    } catch (error) {
        console.error("Error updating shift time:", error);
        res.status(500).json({
            success: false,
            message: "Error updating shift time",
            error: error.message,
        });
    }
};

// Delete shift time
export const deleteShiftTime = async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await shiftTimeModel.findOneAndDelete({ id });
        if (!deleted)
            return res
                .status(404)
                .json({ success: false, message: "Shift time not found" });

        res.status(200).json({
            success: true,
            message: "Shift time deleted successfully",
            data: deleted,
        });
    } catch (error) {
        console.error("Error deleting shift time:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting shift time",
            error: error.message,
        });
    }
};
