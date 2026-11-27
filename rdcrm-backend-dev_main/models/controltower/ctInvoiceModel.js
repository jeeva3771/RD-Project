import mongoose from 'mongoose';

const ctInvoiceSchema = new mongoose.Schema({
    job_no: { type: String, required: true },
    sub_job_no: { type: String, required: true },
    invoiceNo: { type: String, required: true, unique: true },
    qty: { type: Number, required: true },
    pricePerQty: { type: Number, required: true },
    gstPct: { type: Number, required: true },
    gst_tax: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'tax_masters',
        default: null
    },
    subtotal: { type: Number, required: true },
    gstAmt: { type: Number, required: true },
    totalAmt: { type: Number, required: true },
    by: { type: String, required: true },
    remarks: { type: String },
    time: { type: String },
    pdf_url: { type: String },
    dueDate: { type: Date },
    date: { type: Date, default: Date.now }
}, {
    timestamps: true
});

const CtInvoice = mongoose.model('ct_invoice', ctInvoiceSchema);
export default CtInvoice;
