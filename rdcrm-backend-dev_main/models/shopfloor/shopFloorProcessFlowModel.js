import mongoose from "mongoose";

const shopfloorProcessFlowSchema = new mongoose.Schema({
    job_no: { type: String, required: true },
    sub_job_no: { type: String, required: true },
    category: { type: String },
    subcategory: { type: String },
    shopfloor_job_id: { type: mongoose.ObjectId, ref: "shop_floor_job", required: true },
    store_material_issue_id: { type: mongoose.ObjectId, ref: "store_material_issue" },
    group_id: { type: String, required: true },
    bom_sample_status: {
        type: String,
        enum: ['PENDING_SAMPLE', 'IN_SAMPLE_PIPELINE', 'SAMPLE_REJECTED_INTERNAL', 'AWAITING_SALES_APPROVAL', 'APPROVED_BY_SALES', 'REJECTED_BY_SALES'],
        default: 'PENDING_SAMPLE'
    },
    sales_approval_details: {
        final_sample_image: { type: String },
        approved_by: { type: mongoose.Schema.Types.Mixed },
        approved_by_name: { type: String },
        action_at: { type: String },
        reject_reason: { type: String }
    },
    session_state: {
        quantities: { type: mongoose.Schema.Types.Mixed, default: {} },
        sampleUps: { type: mongoose.Schema.Types.Mixed, default: {} },
        runningCycles: { type: mongoose.Schema.Types.Mixed, default: {} },
        localLogs: { type: mongoose.Schema.Types.Mixed, default: [] },
        sampleInputs: { type: mongoose.Schema.Types.Mixed, default: {} },
        primaryUnlocked: { type: mongoose.Schema.Types.Mixed, default: {} },
        primaryUps: { type: mongoose.Schema.Types.Mixed, default: {} },
        isUpsConfirmed: { type: mongoose.Schema.Types.Mixed, default: {} },
        selectedOperator: { type: mongoose.Schema.Types.Mixed, default: {} },
        selectedHeads: { type: mongoose.Schema.Types.Mixed, default: {} },
        groupTimers: { type: mongoose.Schema.Types.Mixed, default: {} },
        haveExcessSheet: { type: mongoose.Schema.Types.Mixed, default: false },
        excessConfirmed: { type: mongoose.Schema.Types.Mixed, default: {} },
        sample_cycles: [{
            cycle_number: Number,
            start_time: String,
            end_time: String,
            started_by: { type: mongoose.Schema.Types.Mixed },
            started_by_name: String,
            sample_qty: Number,
            good_qty: { type: Number, default: 0 },
            bad_qty: { type: Number, default: 0 },
            duration: String,
            status: String,
            action_by: { type: mongoose.Schema.Types.Mixed },
            action_by_name: String,
            action_at: String,
            reject_reason: String,
            sample_image: String,
            handed_over: { type: Boolean, default: false }
        }],
        primary_cycles: [{
            cycle_number: Number,
            start_time: String,
            end_time: String,
            started_by: { type: mongoose.Schema.Types.Mixed },
            started_by_name: String,
            ups: Number,
            good_qty: { type: Number, default: 0 },
            bad_qty: { type: Number, default: 0 },
            duration: String,
            status: String,
            handed_over: { type: Boolean, default: false }
        }],
        recut_cycles: [{
            cycle_number: Number,
            start_time: String,
            end_time: String,
            started_by: { type: mongoose.Schema.Types.Mixed },
            started_by_name: String,
            ups: Number,
            good_qty: { type: Number, default: 0 },
            bad_qty: { type: Number, default: 0 },
            duration: String,
            status: String,
            handed_over: { type: Boolean, default: false }
        }],
        primary_cycle_history: [{
            cycle: Number,
            ups: Number,
            added_by: String,
            added_at: { type: Date, default: Date.now }
        }]
    },
    excess_stock: [{
        group_name: { type: String, required: true },
        process_name: { type: String, required: true },
        excess_qty: { type: Number, required: true },
        excess_sqft: { type: Number, default: 0 },
        timestamp: { type: Date, default: Date.now }
    }],
    rejection: [{
        material_name: { type: String, required: true },
        size: { type: String, default: "12x18" },
        rejected_qty: { type: Number, required: true },
        recut_qty: { type: Number, default: 0 },
        sqin_lost: { type: Number, default: 0 },
        sqft_lost: { type: Number, default: 0 },
        machine: { type: String, default: "Shift 1" },
        est_loss: { type: Number, default: 0 },
        recut_status: { type: String, default: "No - 0 pcs" },
        write_off_status: { type: String, enum: ['Pending', 'Authorized'], default: 'Pending' },
        timestamp: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

export default mongoose.model("shop_floor_process_flow", shopfloorProcessFlowSchema);
