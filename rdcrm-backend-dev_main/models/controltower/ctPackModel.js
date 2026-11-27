import mongoose from 'mongoose';

const ctPackSchema = new mongoose.Schema({
    job_no: { type: String, required: true },
    sub_job_no: { type: String, required: true, unique: true },
    client_name: { type: String },
    product_name: { type: String },
    product_image: { type: String },
    job_completion_date: { type: mongoose.Schema.Types.Mixed },
    delivery_date: { type: mongoose.Schema.Types.Mixed },
    total_qty: { type: Number, default: 0 },
    received_from_qc: { type: Number, default: 0 },
    packed_qty: { type: Number, default: 0 },
    packedBy: { type: String },
    packingDt: { type: String },
    boxCount: { type: Number },
    packingNote: { type: String },

    // Delivery Challan Fields
    challanNo: { type: String },
    challanDate: { type: String },
    challanNote: { type: String },
    challanFile: { type: String, default: "" },
    challanFiles: { type: [String], default: [] },
    challanList: { type: mongoose.Schema.Types.Mixed, default: [] },

    stage: { type: String, default: 'qc_pending' },
    status: { type: String, default: 'Pending' },

    // Wizard State Fields
    qcAcceptedQty: { type: Number, default: 0 },
    qcAcceptedBy: { type: String },
    qcAcceptedDt: { type: String },
    qcNote: { type: String, default: "" },
    qcPartial: { type: Boolean, default: false },

    pmatStatus: { type: String, default: "pending" },
    pmatItems: { type: mongoose.Schema.Types.Mixed, default: [] },

    instructionType: { type: String },
    instructionFile: { type: String },
    instructionNote: { type: String },
    dispatchFiles: { type: [String], default: [] },
    dispatchFileStatus: { type: String, default: 'pending' },
    dispatchFileRejections: [{
        remarks: String,
        type: { type: String }, // 'existing' or 'new'
        fileNames: [String],
        fileUrls: [String],
        rejectedBy: String,
        date: { type: Date, default: Date.now }
    }],

    destinationType: { type: String },
    destinations: { type: mongoose.Schema.Types.Mixed, default: [] },

    dispatchType: { type: String },
    courierName: { type: String },
    awbNumbers: { type: [String], default: [] },
    shipments: { type: mongoose.Schema.Types.Mixed, default: [] },
    dispatchDt: { type: String },
    expectedDelivery: { type: String },
    deliveredQty: { type: Number, default: 0 },
    labelsGenerated: { type: Boolean, default: false },
    labelsUploaded: { type: Boolean, default: false },
    labelFiles: { type: [String], default: [] },
    misLabelUploaded: { type: Boolean, default: false },
    misLabelFiles: { type: [String], default: [] },

    handDelivery: { type: mongoose.Schema.Types.Mixed, default: [] },
    clientPickup: { type: mongoose.Schema.Types.Mixed, default: [] },
    completedDt: { type: String },
    logs: [{
        type: { type: String }, // 'HANDOVER_RECEIVED', 'PACKED'
        qty: Number,
        by: String,
        remarks: String,
        date: { type: Date, default: Date.now },
        dt: { type: String },
        msg: { type: String }
    }]
}, {
    timestamps: true,
    optimisticConcurrency: true
});

const CtPack = mongoose.model('ct_pack', ctPackSchema);
export default CtPack;
