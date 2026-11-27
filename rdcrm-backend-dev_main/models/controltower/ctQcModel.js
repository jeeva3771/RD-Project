import mongoose from 'mongoose';

const ctQcSchema = new mongoose.Schema({
    job_no: { type: String, required: true },
    sub_job_no: { type: String, required: true, unique: true },
    client_name: { type: String },
    product_name: { type: String },
    product_image: { type: String },
    job_completion_date: { type: mongoose.Schema.Types.Mixed },
    delivery_date: { type: mongoose.Schema.Types.Mixed },
    total_qty: { type: Number, default: 0 },
    received_from_inward: { type: Number, default: 0 },
    arrived_qty: { type: Number, default: 0 },
    qc_good_qty: { type: Number, default: 0 },
    qc_bad_qty: { type: Number, default: 0 },
    rejected_handover_qty: { type: Number, default: 0 }, // For Rejection & Replacement cycle
    released_to_packing_qty: { type: Number, default: 0 }, // For handover to packing
    status: { type: String, default: 'Pending' },
    logs: [{
        type: { type: String },
        qty: Number,
        good: Number,
        bad: Number,
        by: String,
        remarks: String,
        department: String,
        date: { type: Date, default: Date.now }
    }]
}, {
    timestamps: true,
    optimisticConcurrency: true
});

const CtQc = mongoose.model('ct_qc', ctQcSchema);
export default CtQc;
