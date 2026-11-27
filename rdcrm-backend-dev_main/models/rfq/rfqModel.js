import mongoose from "mongoose";

const rfqSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true }, // RFQ-XXXX
    jobNo: { type: String }, // Link to main job
    subJobNo: { type: String }, // Link to sub job
    category: { type: String },
    category_id: { type: mongoose.Schema.Types.ObjectId, ref: "material_categories" },
    material_category_id: { type: mongoose.Schema.Types.ObjectId, ref: "material_categories" },
    material_type_id: { type: mongoose.Schema.Types.ObjectId, ref: "material_types" },
    sales_order_nanoid: { type: String, default: null },
    subcategory: { type: String },
    client: { type: String },
    name: { type: String }, // Item name
    item_id: { type: String, default: null }, // Link to inventory item (Custom or Standard)
    is_custom_item: { type: Boolean, default: false }, // Flag to differentiate custom vs standard
    vendorName: { type: String }, // Pre-assigned vendor for Custom items
    specs: { type: String },
    qty: { type: Number },
    deadline: { type: Date },
    image: { type: String }, // URL or Base64 (better URL from R2)
    stage: { type: String, default: "1. Draft RFQ" },
    is_on_hold: { type: Boolean, default: false },

    // AI / Packing Data
    aiBaseRate: { type: Number },
    logicalRate: { type: Array, default: [] },
    packingBufferVal: { type: Number },
    packingBufferPrc: { type: Number },
    packingFinalQty: { type: Number },
    // selectedVendors: [{ type: String }], // List of vendor names
    selectedVendors: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "vendors"
    }],

    quotes: [{
        vendor: { type: mongoose.Schema.Types.ObjectId, ref: "vendors" },
        vendorName: { type: String },
        rate: { type: Number },
        delDays: { type: Number }, // Combined or max delivery days
        delDate: { type: Date },   // Specific delivery date-time
        isScheduleConfirmed: { type: Boolean, default: false },
        scheduleResponses: [{
            splitIdx: { type: Number },
            isConfirmed: { type: Boolean },
            delDays: { type: Number }, // Days for this specific split
            delDate: { type: Date },   // Date for this specific split
            qty: { type: Number }      // Quantity for this specific split
        }],
        receivedAt: { type: Date, default: Date.now }
    }],

    awards: [{
        poNumber: { type: String },
        vendor: { type: mongoose.Schema.Types.ObjectId, ref: "vendors" },
        vendorName: { type: String },
        qty: { type: Number },
        rate: { type: Number },
        trans: { type: Number, default: 0 },
        tax: { type: String, default: '18% GST' },
        awardedAt: { type: Date, default: Date.now },

        // ── Per-PO Coordination ────────────────────────────────────────────────
        // Each award (PO number) moves independently through the Kanban
        coordStage: { type: String, default: null }, // PENDING ACK | EN ROUTE | QC CHECK | STORES INWARD | ESCALATED
        poDeliveryDate: { type: Date, default: null },   // ETA for this specific PO (overrides parent RFQ deadline)
        oldPoDeliveryDate: { type: Date, default: null },// Stores original ETA when updated for tracking escalation/restoration
        coordLogs: [{
            date: { type: Date, default: Date.now },
            action: { type: String },  // ETA UPDATED | STAGE MOVED | COORDINATOR REMARK
            note: { type: String },
            user: { type: String },
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        }],
        // Inward accounting per PO — full Transaction Audit Protocol
        inwardOrdered: { type: Number, default: 0 },   // PO qty ordered
        inwardReceived: { type: Number, default: 0 },   // Arrival Registry — goods physically arrived
        inwardGood: { type: Number, default: 0 },   // QC passed
        inwardRejected: { type: Number, default: 0 },   // QC failed
        inwardIssued: { type: Number, default: 0 },   // Released to production floor
        inwardInvoiced: { type: Number, default: 0 },   // Total invoiced so far
        inwardReturned: { type: Number, default: 0 },   // Physically returned to vendor
        inwardReinward: { type: Number, default: 0 },   // Replacement stock received back
        inwardIsEscalated: { type: Boolean, default: false },
        inwardHistory: [{
            time: { type: String },
            msg: { type: String },
        }],
        inwardChallans: [{
            qty: { type: Number },
            challanNo: { type: String },
            date: { type: Date },
            docUrl: { type: String }
        }],
        inwardUpdatedAt: { type: Date, default: null },

        // Custom PO Delivery Schedule (Single or Split)
        deliverySchedule: [{
            date: { type: Date },
            time: { type: String },
            qty: { type: Number }
        }],

        // ── Proposed Changes Alerts (Synced from Sales Order edits) ───────────
        currentJobQty: { type: Number },
        current_delivery_date: { type: Date },
        current_job_completion_date: { type: Date },
        pendingQtyChange: { type: Boolean, default: false },
        newQtyRequest: { type: Number, default: null },
        pendingDateChange: { type: Boolean, default: false },
        newDateRequest: { type: Date, default: null },
        pendingJobCompletionChange: { type: Boolean, default: false },
        newJobCompletionRequest: { type: Date, default: null },
    }],


    deliverySchedule: [{
        date: { type: Date },
        qty: { type: Number }
    }],

    isSplit: { type: Boolean, default: false },
    deliveryDate: { type: Date },
    deliveryTime: { type: String },
    linksDuration: { type: Number, default: 48 },
    remarks: { type: String, default: "" },

    // ── Procurement Coordination ──────────────────────────────────────────────
    // Tracks which Kanban column this PO sits in (set by coordinator)
    coordStage: { type: String, default: null }, // PENDING ACK | EN ROUTE | QC CHECK | STORES INWARD | ESCALATED

    // Full audit trail — every coordinator action appends here
    coordLogs: [{
        date: { type: Date, default: Date.now },
        action: { type: String },   // e.g. "ETA UPDATED", "STAGE MOVED", "COORDINATOR REMARK"
        note: { type: String },   // free-text remark / detail
        user: { type: String },   // coordinator username or email
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    }],

    // Inward accounting tracked per PO (used in Ledger view)
    inwardAccounting: {
        ordered: { type: Number, default: 0 },
        inwardGood: { type: Number, default: 0 },
        rejected: { type: Number, default: 0 },
        reInward: { type: Number, default: 0 },
        lastUpdated: { type: Date, default: null },
    },

    is_ordered: { type: Boolean, default: false },

    source: { type: String, default: null }, // BULK, AI, CUSTOM, STORE

    broadcastSentAt: { type: Date, default: null },

    // Per-vendor unique tokens — each vendor gets their own secret link token
    vendorTokens: [{
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'vendors' },
        vendorName: { type: String },
        token: { type: String }  // nanoid(32) unique per vendor
    }],

    reference_no: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    status: { type: String, default: "Active" }, // Active, Closed, Archived

}, { timestamps: true });

export default mongoose.model("RFQ", rfqSchema);
