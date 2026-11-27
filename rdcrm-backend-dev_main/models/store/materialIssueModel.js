import mongoose from "mongoose";

const storeMaterialIssueSchema = new mongoose.Schema({
    dtp_id: { type: mongoose.ObjectId, ref: "dtp_studio", required: true },
    sample_order_id: { type: mongoose.ObjectId, ref: "salesorder", required: true },
    enquiry_id: { type: mongoose.ObjectId, ref: "enquiry" },
    job_no: { type: String, required: true },
    sub_job_no: { type: String, required: true },
    client_name: { type: String },
    product_name: { type: String },
    product_image: { type: String },
    delivery_date: { type: String },
    job_completion_date: { type: String },
    job_quantity: { type: Number },

    // Change flags for notifications
    is_qty_changed: { type: Boolean, default: false },
    is_date_changed: { type: Boolean, default: false },
    is_on_hold: { type: Boolean, default: false },

    // Status for Store Workflow
    status: {
        type: String,
        enum: ['NEW', 'PARTIAL', 'ISSUED', 'ALERT'],
        default: 'NEW'
    },

    materials: [
        {
            item_id: { type: String },
            material_id: { type: mongoose.ObjectId, ref: "item" },
            material_name: { type: String },
            material_type: { type: String },
            type: { type: String },
            specs: { type: String },
            department: { type: String },
            required_qty: { type: Number },
            issued_qty: { type: Number, default: 0 },
            returned_qty: { type: Number, default: 0 },
            laserreturn_qty: { type: Number, default: 0 },
            unit: { type: String },
            logs: [
                {
                    qty: { type: Number },
                    type: { type: String, enum: ['ISSUE', 'RETURN'] },
                    dept: { type: String },
                    recipient: { type: String },
                    recorded_by: { type: mongoose.ObjectId, ref: "users" },
                    recorded_at: { type: String }
                }
            ]
        }
    ],

    material_groups: { type: Array },
    materialprocess: { type: Array },
    items: { type: Array },

    // Exception Tracking
    esc_alert: {
        is_active: { type: Boolean, default: false },
        remark: { type: String },
        marked_at: { type: String },
        marked_by: { type: mongoose.ObjectId, ref: "users" }
    },

    reference_no: { type: String },
    is_active: { type: Boolean, default: true },
    created_at: { type: String },
    updated_at: { type: String }
});

export default mongoose.model("store_material_issue", storeMaterialIssueSchema);
