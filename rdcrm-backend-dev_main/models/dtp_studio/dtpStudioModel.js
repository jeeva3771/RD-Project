import mongoose from "mongoose";

const dtpStudioSchema = new mongoose.Schema({
    sample_order_id: { type: mongoose.ObjectId, ref: "salesorder", required: true },
    bom_id: { type: mongoose.ObjectId, ref: "bom" },
    job_no: { type: String, required: true },
    sub_job_no: { type: String, required: true },
    group_id: { type: mongoose.ObjectId, ref: "dtp_group" },

    // Job Details
    client_name: { type: String },
    product_name: { type: String },
    job_quantity: { type: Number },
    artwork_files: [{ type: String }], // URLs to artwork files (PDF/CDR)
    image: { type: String }, // Sales Order Image URL
    reference_enquiry: { type: String }, // Store enquiry reference (e.g., job_no or name)
    enquiry_id: { type: mongoose.ObjectId, ref: "enquiry" },
    assigned_to: { type: mongoose.ObjectId, ref: "users" }, // Artist assigned to the job
    assigned_to_name: { type: String }, // Artist name for quick display
    assigned_at: { type: String },
    job_sheet: {
        materialSpecification: [
            {
                material_id: { type: mongoose.ObjectId, ref: "item" },
                material_name: String,
                material_type: String,
                alias: String,
                color: String,
                input: Object,
                wastage: Object,
                final_total: Number,
                rate: String,
                unitRate: Number,
                jobTotal: Number,
            },
        ],
        materialprocess: [
            {
                material_group_id: String,
                material_group_name: String,
                processes: [
                    {
                        process_name: String,
                        input: {
                            baselength: { type: Number, required: false, default: null }, // optional
                            basewidth: { type: Number, required: false, default: null },  // optional
                            length: { type: Number, required: false, default: null },
                            width: { type: Number, required: false, default: null },
                            length_gap: { type: Number, required: false, default: null },
                            width_gap: { type: Number, required: false, default: null },
                            actual_input: { type: Number, required: true },
                        },
                        outsource: Number,
                        outsource_type: String,
                        vendor: String,
                        rate: Number,
                        unit_cost: Number,
                        job_cost: Number,
                        prompt: String,
                        status: { type: String, default: 'Pending' }, // e.g., Pending, Completed
                        completed_qty: { type: Number, default: 0 },
                        status_by: { type: mongoose.ObjectId, ref: "users" },
                        updated_at: { type: String }
                    },
                ],
            },
        ],
        packingdatas: [
            {
                itemId: { type: mongoose.ObjectId, ref: "item" },
                name: String,
                itemType: String,
                unitCost: Number,
                logicalRate: Array,
                qty: String,
                logic1: String,
                logic2: String,
                logic3: String,
                total: Number,
                finaltotal: Number,
                jobTotal: Number,
            },
        ],
    },

    // Dates
    delivery_date: { type: String },
    job_completion_date: { type: String },
    actual_completion_date: { type: String },

    // Workflow Status
    status: {
        type: String,
        enum: ['Pending', 'Assigned', 'Master Template', 'Content Proofing', 'Final Prep', 'Push to Floor', 'Accounting Quantity', 'Shop Floor', 'Completed', 'Reprocess', 'Hold'],
        default: 'Pending'
    },

    // Track updates at every stage (Job Sheet List)
    stage_updates: [{
        stage_name: { type: String }, // e.g., "Initial Setup", "Proofing", "Final Output"
        job_sheet_files: [{ type: String }], // URLs to files
        remarks: { type: String },
        updated_by: { type: mongoose.ObjectId, ref: "users" },
        updated_at: { type: String }
    }],

    // Master Template Proofs
    master_template_files: [{
        file_url: { type: String, required: true },
        status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Alteration'], default: 'Pending' },
        rejection_reason: { type: String },
        alteration_notes: { type: String },
        rejection_reference_file: { type: String }, // URL to optional reference file for rejection
        action_by_type: { type: String },
        action_by_user: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        action_by_name: { type: String },
        action_by_role: { type: String },
        approved_by: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        approved_by_name: { type: String },
        approved_date_time: { type: String },
        approved_at: { type: String },
        rejected_by: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        rejected_by_name: { type: String },
        rejected_date_time: { type: String },
        rejected_at: { type: String },
        uploaded_by: { type: mongoose.ObjectId, ref: "users" },
        uploaded_at: { type: String }
    }],

    // Content Proofing Proofs
    content_proofing_files: [{
        file_url: { type: String, required: true },
        status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Alteration'], default: 'Pending' },
        rejection_reason: { type: String },
        alteration_notes: { type: String },
        rejection_reference_file: { type: String }, // URL to optional reference file for rejection
        action_by_type: { type: String },
        action_by_user: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        action_by_name: { type: String },
        action_by_role: { type: String },
        approved_by: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        approved_by_name: { type: String },
        approved_date_time: { type: String },
        approved_at: { type: String },
        rejected_by: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        rejected_by_name: { type: String },
        rejected_date_time: { type: String },
        rejected_at: { type: String },
        uploaded_by: { type: mongoose.ObjectId, ref: "users" },
        uploaded_at: { type: String }
    }],

    // Final Prep Files
    final_prep_files: [{
        material_group_id: { type: String },
        material_group_name: { type: String },
        status: { type: String, default: 'Pending' }, // e.g., 'Pending', 'ready to shop floor'
        accounting_quantity: { type: Number }, // User input quantity
        original_quantity: { type: Number }, // Quantity from price module (snapshot)
        production_files: [{
            file_url: { type: String },
            pre_flight_checked: {
                fonts_to_curves: { type: Boolean, default: false },
                cmyk_mode: { type: Boolean, default: false },
                bleeds_checked: { type: Boolean, default: false }
            },
            uploaded_at: { type: String },
            uploaded_by: { type: mongoose.ObjectId, ref: "users" }
        }],
        reference_images: [{
            file_url: { type: String },
            uploaded_at: { type: String },
            uploaded_by: { type: mongoose.ObjectId, ref: "users" }
        }]
    }],

    // Accounting & Packing Details (Step 6)
    accounting_details: {
        trophies_count: { type: Number },
        blanks_count: { type: Number },
        processing_files: [{
            file_url: { type: String },
            original_name: { type: String },
            file_type: { type: String }, // 'csv' or 'excel'
            uploaded_at: { type: String },
            uploaded_by: { type: mongoose.ObjectId, ref: "users" }
        }]
    },

    // Rework/Rollback Tracking
    rework_history: [{
        from_stage: { type: String },
        to_stage: { type: String },
        reason: { type: String },
        marked_by: { type: mongoose.ObjectId, ref: "users" },
        date: { type: String }
    }],

    // General History/Audit Log
    history: [{
        action: { type: String }, // e.g., "Created", "Status Changed", "File Uploaded"
        description: { type: String },
        user: { type: mongoose.ObjectId, ref: "users" },
        is_client_approval: { type: Boolean, default: false },
        date: { type: String }
    }],

    is_active: { type: Boolean, default: true },
    urgency_sent: { type: Boolean, default: false },
    is_on_hold: { type: Boolean, default: false },
    is_qty_changed: { type: Boolean, default: false },
    is_date_changed: { type: Boolean, default: false },
    hold_history: [
        {
            reason: String,
            start_time: String,
            end_time: String,
            hold_by: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "users",
            },
            unhold_by: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "users",
            },
        }
    ],
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    created_at: { type: String },
    updated_at: { type: String }
});

export default mongoose.model("dtp_studio", dtpStudioSchema);
