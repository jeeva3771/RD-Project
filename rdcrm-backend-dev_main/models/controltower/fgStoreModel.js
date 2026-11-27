import mongoose from 'mongoose';

const fgStoreSchema = new mongoose.Schema({
    job_no: { type: String, required: true },
    sub_job_no: { type: String, required: true, unique: true },
    client_name: { type: String },
    product_name: { type: String },
    category: { type: String },
    subcategory: { type: String },
    product_image: { type: String },
    delivery_date: { type: String },
    job_completion_date: { type: String },
    total_qty: { type: Number, default: 0 },
    unit_price: { type: Number, default: 0 },
    payment_terms: { type: String },
    shopfloor_handed_over_qty: { type: Number, default: 0 },
    inward_qty: { type: Number, default: 0 },
    invoiced_qty: { type: Number, default: 0 },
    balance_qty: { type: Number, default: 0 },
    stage: { type: String, enum: ['INWARD', 'QC', 'PACKING', 'INVOICE', 'DISPATCH', 'DISPATCHED', 'COMPLETED'], default: 'INWARD' },
    status: { type: String, default: 'Pending' },

    logs: [{
        type: { type: String },
        qty: Number,
        good: Number,
        bad: Number,
        by: String,
        time: String,
        remarks: String,
        date: { type: Date, default: Date.now }
    }]
}, {
    timestamps: true,
    optimisticConcurrency: true
});

const FgStore = mongoose.model('fg_store', fgStoreSchema);
export default FgStore;
