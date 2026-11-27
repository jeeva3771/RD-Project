import mongoose from "mongoose";

const shopFloorJobSchema = new mongoose.Schema({
    sales_order_id: { type: mongoose.ObjectId, ref: "salesorder", required: true },
    bom_id: { type: mongoose.ObjectId, ref: "bom" },
    dtp_id: { type: mongoose.ObjectId, ref: "dtp_studio" },
    enquiry_id: { type: mongoose.ObjectId, ref: "enquiry" },
    store_material_issue_id: { type: mongoose.ObjectId, ref: "store_material_issue" },
    job_no: { type: String, required: true },
    sub_job_no: { type: String, required: true },

    // Process Identity
    process_id: { type: String }, // From BOM job sheet
    process_name: { type: String, required: true },
    department: { type: String },

    // Grouped Material data belonging to this process
    material_groups: [{
        group_id: String,
        group_name: String,

        // List of all materials in this specific group
        materials: [{
            item_id: String,
            material_name: String,
            material_type: String,
            material_input: Object,
            quantity: Number,
            category_type: String,
            unit: String,
            size: String
        }],

        // Group-specific process settings from Job Sheet
        input: Object,
        process_index: String,
        process_rate: Number,
        progress: { type: Number, default: 0 },

        // BOM Planning Reference
        bom_inhouse_qty: { type: Number, default: 0 },
        bom_outsource_qty: { type: Number, default: 0 },

        // Outsource Information for this specific group
        is_outsource: { type: Boolean, default: false },
        row_type: String,
        outsource_type: String,
        vendor_id: { type: mongoose.ObjectId, ref: "outsource_vendors" },
        vendor_name: String,
        outsource_rate: Number,
        outsource_qty: { type: Number, default: 0 },      // BOM-planned outsource units — DO NOT OVERWRITE
        inhouse_qty: { type: Number, default: 0 },         // BOM-planned inhouse units
        process_qty: { type: Number, default: 0 },
        outsource_delivery_date: String,

        // Actual operator-assigned outsource (separate from BOM plan)
        assigned_outsource_sheets: { type: Number, default: 0 },
        assigned_outsource_ups: { type: Number, default: 0 },

        // Support for splitting among multiple vendors
        outsource_assignments: [{
            vendor_id: { type: mongoose.ObjectId, ref: "outsource_vendors" },
            vendor_name: String,
            outsource_rate: Number,
            outsource_qty: Number,
            outsource_sheets: Number,
            outsource_delivery_date: String,
            assigned_at: String,
            assigned_by: { type: mongoose.ObjectId, ref: "users" },
            current_stage_idx: { type: Number, default: 0 },
            batch_receipts: [{
                type: { type: String, enum: ['expected', 'actual'] },
                qty: Number,
                date: String,
                time: String,
                updated_at: String,
                updated_by: { type: mongoose.ObjectId, ref: "users" }
            }],
            stage_history: [{
                stage_idx: Number,
                stage_label: String,
                updated_at: String,
                updated_by: { type: mongoose.ObjectId, ref: "users" }
            }],
            invoice_no: String,
            invoice_date: String,
            invoice_amt: Number,
            invoice_qty: Number,
            invoice_rate: Number,
            invoice_url: String,
            invoice_file_name: String,
            invoices: [{
                invoice_no: { type: String, trim: true },
                invoice_date: String,
                invoice_qty: Number,
                invoice_rate: Number,
                invoice_amt: Number,
                invoice_url: String,
                invoice_file_name: String,
                created_at: { type: Date, default: Date.now },
                created_by: { type: mongoose.ObjectId, ref: "users" },
                created_by_name: String
            }],
            token: String,
            token_expires_at: Date,
            rejection_reason: String,
            status: { type: String, default: 'Pending' }
        }],

        assigned_shifts: [{ type: mongoose.Schema.Types.Mixed }], // Legacy: [1, 2, 3], Modern: ["Team A"]
        sampling_on: { type: Boolean, default: false },
        sides: { type: Number, default: 1 },
        final_prep_file: Object, // From DTP
        sales_order_process_file: Object, // From Sales Order List
        inward_history: [{
            inward_id: { type: mongoose.ObjectId, ref: "shop_floor_inward" },
            inspect_qty: Number,
            good_qty: Number,
            bad_qty: Number,
            operator_name: String,
            operator_id: { type: mongoose.ObjectId, ref: "users" },
            remarks: String,
            materials: [{
                material_name: String,
                rate: Number,
                sq_inch_per_unit: Number
            }],
            total_sq_inch_accepted: Number,
            accepted_value: Number,
            timestamp: String,
            laser_return: { type: Boolean, default: false },
            created_at: String
        }],
        process_history: [{
            activity_type: String, // 'Sampling', 'Production', 'System'
            action: String,        // 'CONSOLE READY', 'START', 'PAUSE' etc
            operator_name: String,
            operator_id: { type: mongoose.ObjectId, ref: "users" },
            timestamp: String,
            affected_groups: [String],
            details: {
                remarks: String,
                good_qty: Number,
                bad_qty: Number
            }
        }],
        status: { type: String, default: 'Pending' }
    }],

    // Workflow State
    status: {
        type: String,
        enum: ['Pending', 'In Progress', 'Completed', 'Hold'],
        default: 'Pending'
    },
    status_by: { type: mongoose.ObjectId, ref: "users" },
    completed_qty: { type: Number, default: 0 },
    progress: { type: Number, default: 0 },
    assigned_shifts: [{ type: mongoose.Schema.Types.Mixed }], // Legacy: [1, 2, 3], Modern: ["Team A"]
    team_allocations: [{
        team_id: { type: mongoose.Schema.Types.ObjectId, ref: "teams" },
        team_name: { type: String },
        allocated_qty: { type: Number, default: 0 },
        completed_qty: { type: Number, default: 0 }
    }],
    assigned_at: { type: String },
    completed_at: { type: String },

    // Tracking
    product_image: { type: String },
    client_name: { type: String },
    product_name: { type: String },
    category: { type: String },
    subcategory: { type: String },
    delivery_date: { type: String },
    job_completion_date: { type: String },
    job_type: { type: String },
    sample_required: { type: Boolean, default: false },
    reference_no: { type: String },
    total_qty: { type: Number, default: 0 },

    // Notification Flags
    is_qty_changed: { type: Boolean, default: false },
    is_date_changed: { type: Boolean, default: false },
    is_escalated: { type: Boolean, default: false },
    is_hold: { type: Boolean, default: false },
    hold_remarks: { type: String },
    escalation_hold_history: [{
        type: { type: String, enum: ['Escalated', 'De-Escalated', 'Hold', 'Resume'] },
        remarks: String,
        at: String,
        by: { type: mongoose.ObjectId, ref: "users" }
    }],

    // Reprocess tracking fields
    is_reprocess: { type: Boolean, default: false },
    reprocess_count: { type: Number, default: 0 },
    parent_job_id: { type: mongoose.ObjectId, ref: "shop_floor_job" },
    reprocess_created_from: { type: String },


    assign_history: [{
        shifts: [Number],
        assigned_by: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        assigned_at: String,
        remark: String,
        is_reassign: { type: Boolean, default: false },
        group_id: String,
        group_name: String,
        vendor_id: { type: mongoose.Schema.Types.ObjectId, ref: "outsource_vendors" },
        price: Number,
        status: String,
        rejection_reason: String,
        sheet_qty: Number,
        output_qty: Number,
        outsource_delivery_date: String
    }],

    created_at: { type: String },
    updated_at: { type: String }
}, { timestamps: true });

export default mongoose.model("shop_floor_job", shopFloorJobSchema);
