import mongoose from "mongoose";
import { nanoid } from "nanoid";

const shiftTimeSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true,
            default: () => nanoid(7),
            index: { unique: true },
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        start_time: {
            type: String,
            required: true,
            trim: true,
        },
        end_time: {
            type: String,
            required: true,
            trim: true,
        },
        is_active: {
            type: Boolean,
            default: true,
        },
        created_by: {
            type: mongoose.ObjectId,
            ref: "users",
        },
        updated_by: [
            {
                user: {
                    type: mongoose.ObjectId,
                    ref: "users",
                },
                date: String,
            },
        ],
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("shift_time", shiftTimeSchema);
