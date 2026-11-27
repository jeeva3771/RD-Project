import mongoose from "mongoose";

// Dedicated collection "enquiry_flows" for the new Standalone Enquiry Flow
// Independent from the legacy "enquiries" collection
const subJobSchema = new mongoose.Schema(
  {
    sub_job_no: { type: String, required: true }, // e.g. "RD21072-A1", "RD21072-A2", "RD21072-B1"
    design_group: { type: String, default: "A" }, // "A", "B", "C"
    trophy_type: { type: String, default: "custom" },
    sku: { type: String },
    theme: { type: String },
    product_name: { type: String },
    size: { type: String },
    material: { type: String },
    quantity: { type: Number, default: 0 },
    target_rate: { type: Number, default: 0 },
    line_total: { type: Number, default: 0 },
    stage: {
      type: String,
      enum: [
        "enquiry",
        "brief",
        "sample",
        "production",
        "ready_for_dispatch",
        "dispatched",
        "delivered",
        "closed",
        "cancelled",
        "lost",
      ],
      default: "enquiry",
    },

    // Independent Lifecycle Controls
    is_on_hold: { type: Boolean, default: false },
    hold_reason: { type: String },
    held_at: { type: Date },
    unheld_at: { type: Date },

    is_dropped: { type: Boolean, default: false },
    drop_reason: { type: String },
    dropped_at: { type: Date },

    is_lost: { type: Boolean, default: false },
    lost_stage: { type: String },
    lost_reason: { type: String },
    lost_at: { type: Date },

    // Sub-job specific files in R2 storage
    dtp_files: [
      {
        file_url: { type: String },
        file_name: { type: String },
        file_type: { type: String }, // "cdr", "ai", "pdf", "laser", "uv"
        uploaded_at: { type: Date, default: Date.now },
      },
    ],
    packing_files: [
      {
        file_url: { type: String },
        file_name: { type: String },
        file_type: { type: String }, // "box_photo", "carton_label", "packing_slip"
        uploaded_at: { type: Date, default: Date.now },
      },
    ],
    proof_files: [
      {
        file_url: { type: String },
        file_name: { type: String },
        proof_type: { type: String }, // "client_approval", "po_copy", "screenshot"
        approved: { type: Boolean, default: false },
        uploaded_at: { type: Date, default: Date.now },
      },
    ],
    design_files: [
      {
        file_url: { type: String },
        file_name: { type: String },
        uploaded_at: { type: Date, default: Date.now },
      },
    ],
  },
  { _id: true }
);

const enquiryFlowSchema = new mongoose.Schema(
  {
    enquiry_no: { type: String, unique: true, required: true }, // e.g. "RD21072"
    seq: { type: Number, required: true }, // e.g. 21072
    step: { type: Number, default: 0 }, // Current step (0 to 6) for auto-resume

    // Step 0: Linked Master Data
    customer_id: { type: mongoose.ObjectId, ref: "customer", required: true },
    contact_id: { type: String }, // e.g. "ct1", "ct_add_0"
    ship_to_id: { type: String }, // e.g. "sh_0"
    assigned_to: { type: mongoose.Schema.Types.Mixed }, // CS / Sales Exec (ObjectId or custom string ID)
    coordinator_name: { type: String },

    // Sub-Jobs: Multiple trophies with size variants (RD21072-A1, RD21072-A2, RD21072-B1)
    sub_jobs: [subJobSchema],

    // Step 1: The Ask (Aggregate enquiry details)
    the_ask: {
      product_type: { type: String, default: "Trophy" },
      theme: { type: String, default: "Custom Trophy" },
      ask_mode: { type: String, default: "custom" },
      sku: { type: String },
      product_name: { type: String },
      size: { type: String },
      material: { type: String },
      quantity: { type: Number, default: 0 },
      approx_budget: { type: mongoose.Schema.Types.Mixed },
      budget_none: { type: Boolean, default: false },
      occasion: { type: String },
      scope: { type: String },
      destination_city: { type: String },
      destination_country: { type: String },
      event_date: { type: String },
      delivery_date: { type: String },
      needed_by_date: { type: String },
    },

    // Step 2: The Brief & Design
    the_brief: {
      brief_text: { type: String },
      design_needed: { type: Boolean, default: true },
      options_count: { type: Number, default: 2 },
      ref_files: [{ type: mongoose.Schema.Types.Mixed }],
      client_logo: [{ type: mongoose.Schema.Types.Mixed }],
      show_logo: { type: Boolean, default: false },
      show_content: { type: Boolean, default: false },
      content_text: { type: String },
    },

    // Step 3: Log & Track
    log_track: {
      origin: { type: String, default: "Email" },
      heat_score: { type: Number, default: 50 },
      heat_label: { type: String, default: "Warm" },
      proof_type: { type: String },
      proof_file: { type: String },
      internal_notes: { type: String },
      enq_sent: { type: Boolean, default: false },
      sent_at: { type: Date },
    },

    // Step 4: Sample / Straight to Production
    order_mode: {
      mode: { type: String, default: null },
      charge: { type: String, default: "foc" },
      sample_rate: { type: Number, default: 0 },
      sample_qty: { type: Number, default: 1 },
      sample_approved: { type: Boolean, default: false },
      sample_date: { type: String },
      production_date: { type: String },
    },

    // Step 5: Order Details & Delivery Essentials
    delivery_details: {
      quantity: { type: Number },
      target_rate: { type: Number },
      client_po: { type: String },
      delivery_mode: { type: String },
      delivery_cost: { type: Number, default: 0 },
      who_pays: { type: String, default: "Client" },
      shipping_address: { type: mongoose.Schema.Types.Mixed },
    },

    // Step 6: Commercials & Financial Ledger
    financials: {
      subtotal: { type: Number, default: 0 },
      gst_rate: { type: Number, default: 18 },
      gst_amount: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      advance_percentage: { type: Number, default: 50 },
      advance_required: { type: Number, default: 0 },
      advance_received: { type: Number, default: 0 },
      advance_txn_id: { type: String },
      advance_date: { type: String },
      balance: { type: Number, default: 0 },
      payment_status: { type: String, enum: ["pending", "partial", "paid"], default: "pending" },
      proforma_no: { type: String },
      proforma_date: { type: String },
      tax_invoice_no: { type: String },
      tax_invoice_date: { type: String },
    },

    // Common Files at Enquiry Level (R2)
    common_files: {
      quotations: [
        {
          file_url: { type: String },
          file_name: { type: String },
          uploaded_at: { type: Date, default: Date.now },
        },
      ],
      proforma_invoices: [
        {
          file_url: { type: String },
          file_name: { type: String },
          uploaded_at: { type: Date, default: Date.now },
        },
      ],
      logos: [
        {
          file_url: { type: String },
          file_name: { type: String },
          uploaded_at: { type: Date, default: Date.now },
        },
      ],
    },

    // Overall Pipeline Stage
    stage: {
      type: String,
      enum: [
        "enquiry",
        "brief",
        "sample",
        "production",
        "ready_for_dispatch",
        "dispatched",
        "delivered",
        "closed",
        "cancelled",
        "lost",
      ],
      default: "enquiry",
    },

    // Enquiry Level Lost Status
    is_lost: { type: Boolean, default: false },
    lost_stage: { type: String },
    lost_reason: { type: String },
    lost_to_competitor: { type: String },
    lost_at: { type: Date },
    lost_by: { type: mongoose.Schema.Types.Mixed },

    // Audit History Trail
    history: [
      {
        action: { type: String, required: true },
        step: { type: Number },
        previous_state: { type: String },
        new_state: { type: String },
        sub_job_no: { type: String },
        remarks: { type: String },
        changed_by: {
          user_id: { type: mongoose.Schema.Types.Mixed },
          user_name: { type: String },
          role: { type: String },
        },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    // JSON blob preserving complete React UI State for lossless restoration
    wizard_state: { type: Object },

    created_by: { type: mongoose.Schema.Types.Mixed },
    updated_by: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

// Mongoose model mapped explicitly to the new collection "enquiry_flows"
export default mongoose.model("enquiry_flow", enquiryFlowSchema, "enquiry_flows");
