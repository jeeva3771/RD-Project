import mongoose from "mongoose";
import { nanoid } from "nanoid";

const teamSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true,
            default: () => nanoid(7),
            index: { unique: true },
        },
        team_name: {
            type: String,
            required: true,
            trim: true,
        },
        code: {
            type: String,
            unique: true,
            trim: true,
        },
        shift_timing: {
            type: mongoose.ObjectId,
            ref: "shift_time",
        },
        department_id: {
            type: mongoose.ObjectId,
            ref: "department",
            required: true,
        },
        member_list: [
            {
                type: mongoose.ObjectId,
                ref: "users",
            },
        ],
        is_active: {
            type: Boolean,
            default: true,
        },
        type: {
            type: String,
            default: null,
        },
        color: {
            type: String,
            default: "#cbd5e1"
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

export default mongoose.model("teams", teamSchema);
