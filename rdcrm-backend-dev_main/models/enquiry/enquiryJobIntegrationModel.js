import mongoose from "mongoose";

// Dedicated collection "enquiry_flows_integration" for the Enquiry Flow Integration
// Independent from "enquiry_flows" and legacy "enquiries" collections
const subJobSchema = new mongoose.Schema(
  {
    sub_job_no: { type: String, required: true }, // e.g. "RD21072-A1", "RD21072-A2", "RD21072-B1"
    design_group: { type: String, default: "A" }, // "A", "B", "C"
    trophy_type: { type: String, default: "custom" },
    sku: { type: String },
    theme: { type: String },
    product_name: { type: String },
    size: { type: String, default: "8" },
    material: { type: String, default: "MDF" },
    quantity: { type: Number, default: 50 },
    target_rate: { type: Number, default: 0 },
    line_total: { type: Number, default: 0 },
    sample_rate: { type: Number, default: 0 },
    artwork_charge: { type: Number, default: 0 },
    costing_status: {
      type: String,
      enum: ["not_requested", "pending", "in_costing", "in_progress", "completed", "requested"],
      default: "not_requested",
    },
    costing_requested_at: { type: Date },
    costing_completed_at: { type: Date },
    costing_assigned_to: { type: mongoose.Schema.Types.Mixed },
    bom_id: { type: mongoose.Schema.Types.Mixed, ref: "BOM" },
    bom_nanoid: { type: String, default: "" },
    bom_details: { type: mongoose.Schema.Types.Mixed },
    quote_shared: { type: Boolean, default: false },
    quote_shared_at: { type: Date },
    quote_channel: { type: String },
    client_quote_decision: {
      type: String,
      enum: ["pending", "approved", "rejected", "rework", "revision", "reject"],
      default: "pending",
    },
    client_quote_decision_at: { type: Date },
    client_quote_decision_notes: { type: String },
    spec: { type: mongoose.Schema.Types.Mixed },
    spec_line: { type: String },
    colourQuantities: [{ type: mongoose.Schema.Types.Mixed }],
    colour: { type: String },
    customFinishes: [{ type: mongoose.Schema.Types.Mixed }],
    sizeDimensions: [{ type: mongoose.Schema.Types.Mixed }],
    sizeRate: { type: Number },
    stage: {
      type: String,
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

    // Per Sub-Job Brief & Designer Assignment
    designer_id: { type: mongoose.Schema.Types.Mixed },
    designer_name: { type: String },
    assigned_designer: { type: mongoose.Schema.Types.Mixed },
    assigned_designer_name: { type: String },
    brief_text: { type: String },
    ref_files: [{ type: mongoose.Schema.Types.Mixed }],
    client_logo: [{ type: mongoose.Schema.Types.Mixed }],
    signatures: [{ type: mongoose.Schema.Types.Mixed }],
    additional_files: [{ type: mongoose.Schema.Types.Mixed }],
    is_logo_mandatory: { type: Boolean, default: false },
    is_signature_mandatory: { type: Boolean, default: false },
    is_additional_files_mandatory: { type: Boolean, default: false },
    design_needed: { type: Boolean, default: true },
    options_count: { type: Number, default: 2 },
    show_rd_logo: { type: Boolean, default: false },
    show_rd_content: { type: Boolean, default: false },
    quote_only: { type: Boolean, default: false },

    // Per Sub-Job Design Status & Client Decision
    design_status: {
      type: String,
      enum: ["pending", "uploaded", "approved", "rework", "completed", "processing"],
      default: "pending",
    },
    design_approved: { type: Boolean, default: false },
    design_approved_at: { type: Date },
    approved_design_option: { type: Number },
    product_feedback: { type: mongoose.Schema.Types.Mixed },

    // Sub-job specific files in R2 storage
    dtp_files: [{ type: mongoose.Schema.Types.Mixed }],
    packing_files: [{ type: mongoose.Schema.Types.Mixed }],
    proof_files: [{ type: mongoose.Schema.Types.Mixed }],
    design_files: [{ type: mongoose.Schema.Types.Mixed }],
    designer_files: [{ type: mongoose.Schema.Types.Mixed }],
    is_design_uploaded: { type: Boolean, default: false },

    // Production Hub & Shop Floor Integration References (replaces sales_order_form)
    sample_order_id: { type: mongoose.Schema.Types.ObjectId, ref: "salesorder", default: null },
    sample_order_nanoid: { type: String, default: null },
    sales_order_id: { type: mongoose.Schema.Types.ObjectId, ref: "salesorder", default: null },
    sales_order_nanoid: { type: String, default: null },
    sample_qty: { type: Number, default: 1 },
    dtp_id: { type: mongoose.Schema.Types.ObjectId, ref: "dtp_studio", default: null },
    material_issue_id: { type: mongoose.Schema.Types.ObjectId, ref: "store_material_issue", default: null },
    assembly_team_id: { type: mongoose.Schema.Types.ObjectId, ref: "assemblyteam", default: null },
    shop_floor_job_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: "shopfloorjob" }],
    is_pushed_shop_floor: { type: Boolean, default: false },
    pushed_to_shop_floor_at: { type: Date, default: null },
    production_status: {
      type: String,
      enum: ["pending", "pushed", "process", "in_production", "complete", "completed", "on_hold", "cancelled"],
      default: "pending",
    },
    proof_status: { type: String, default: "pending" },
    proof_sent_at: { type: Date, default: null },
    proof_decision: { type: mongoose.Schema.Types.Mixed, default: null },
    master_template_status: { type: String, default: "pending" },
    master_template_approved_at: { type: Date, default: null },
    content_proof_status: { type: String, default: "pending" },
    content_proof_approved_at: { type: Date, default: null },
    // Dedicated Sample Phase Approvals
    sample_proof_status: { type: String, default: "pending" },
    sample_proof_sent_at: { type: Date, default: null },
    sample_proof_decision: { type: mongoose.Schema.Types.Mixed, default: null },
    sample_master_template_status: { type: String, default: "pending" },
    sample_master_template_approved_at: { type: Date, default: null },
    sample_content_proof_status: { type: String, default: "pending" },
    sample_content_proof_approved_at: { type: Date, default: null },
    // Dedicated Production Phase Approvals
    production_proof_status: { type: String, default: "pending" },
    production_proof_sent_at: { type: Date, default: null },
    production_proof_decision: { type: mongoose.Schema.Types.Mixed, default: null },
    production_master_template_status: { type: String, default: "pending" },
    production_master_template_approved_at: { type: Date, default: null },
    production_content_proof_status: { type: String, default: "pending" },
    production_content_proof_approved_at: { type: Date, default: null },
  },
  { _id: true }
);

const enquiryFlowIntegrationSchema = new mongoose.Schema(
  {
    enquiry_no: { type: String, unique: true, required: true }, // e.g. "RD26001"
    seq: { type: Number, required: true }, // e.g. 1
    year: { type: String, default: "26" },
    step: { type: Number, default: 0 }, // Current step (0 to 6) for auto-resume

    // Step 0: Linked Master Data
    customer_id: { type: mongoose.Schema.Types.Mixed, ref: "customer" },
    contact_id: { type: String }, // e.g. "ct1", "ct_add_0"
    contact_person: { type: String },
    contact_mobile: { type: String },
    contact_email: { type: String },
    ship_to_id: { type: String }, // e.g. "sh_0"
    assigned_to: { type: mongoose.Schema.Types.Mixed }, // CS / Sales Exec (ObjectId or custom string ID)
    coordinator_name: { type: String },
    assigned_designer: { type: mongoose.Schema.Types.Mixed },
    assigned_designer_name: { type: String },

    // Primary Dates
    event_date: { type: String },
    needed_by_date: { type: String },
    delivery_date: { type: String },
    job_completion_date: { type: String },

    // Sub-Jobs: Multiple trophies with size variants (RD21072-A1, RD21072-A2, RD21072-B1)
    sub_jobs: [subJobSchema],

    // Step 1: The Ask (Aggregate enquiry details)
    the_ask: {
      product_type: { type: String, default: "Trophy" },
      theme: { type: String, default: "Custom Trophy" },
      ask_mode: { type: String, default: "custom" },
      sku: { type: String },
      product_name: { type: String },
      size: { type: String, default: "8" },
      material: { type: String, default: "MDF" },
      quantity: { type: Number, default: 50 },
      approx_budget: { type: mongoose.Schema.Types.Mixed },
      budget_none: { type: Boolean, default: false },
      occasion: { type: String },
      scope: { type: String },
      destination_city: { type: String },
      destination_country: { type: String },
      event_date: { type: String },
      delivery_date: { type: String },
      needed_by_date: { type: String },
      job_completion_date: { type: String },
    },

    // Step 2: The Brief & Design
    the_brief: {
      brief_text: { type: String },
      design_needed: { type: Boolean, default: true },
      options_count: { type: Number, default: 2 },
      options_due_in: { type: Number, default: 24 },
      designer_assigned_at: { type: Date },
      ref_files: [{ type: mongoose.Schema.Types.Mixed }],
      client_logo: [{ type: mongoose.Schema.Types.Mixed }],
      signatures: [{ type: mongoose.Schema.Types.Mixed }],
      additional_files: [{ type: mongoose.Schema.Types.Mixed }],
      is_logo_mandatory: { type: Boolean, default: false },
      is_signature_mandatory: { type: Boolean, default: false },
      is_additional_files_mandatory: { type: Boolean, default: false },
      show_logo: { type: Boolean, default: false },
      show_content: { type: Boolean, default: false },
      content_text: { type: String },
      copyright_content: { type: String },
      designer_id: { type: mongoose.Schema.Types.Mixed },
      designer_name: { type: String },
      product_briefs: { type: mongoose.Schema.Types.Mixed },
      quote_only: { type: Boolean, default: false },
      design_status: { type: String, default: "pending" },
      rework_notes: { type: String },
      rework_markup_url: { type: String },
      rework_requested_at: { type: Date },
      rework_requested_by: { type: String },
      last_design_upload: { type: Date },
      links_duration: { type: Number, default: 24 },
      options_shared: { type: Boolean, default: false },
      options_shared_at: { type: Date },
      options_shared_channel: { type: String },
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
    delivery_details: { type: mongoose.Schema.Types.Mixed },

    // Step 5b: Delivery Charges Lifecycle (Packing / Dispatch Estimation)
    delivery_charges: {
      status: {
        type: String,
        enum: ["none", "requested", "quoted", "client_approved", "rejected"],
        default: "none",
      },
      carrier: { type: String }, // "Tempo", "Porter", "Courier", "Air cargo"
      payer: { type: String, enum: ["client", "rd"] }, // "client" | "rd"
      amount: { type: Number, default: 0 },
      courier_partner: { type: String }, // e.g. "Porter", "V-Trans", "DTDC"
      notes: { type: String },
      requested_at: { type: Date },
      requested_by: {
        user_id: { type: mongoose.Schema.Types.Mixed },
        user_name: { type: String },
      },
      quoted_at: { type: Date },
      quoted_by: {
        user_id: { type: mongoose.Schema.Types.Mixed },
        user_name: { type: String },
      },
      destination_area: { type: String },
      destination_city: { type: String },
      address_snapshot: {
        label: { type: String },
        full_address: { type: String },
        city: { type: String },
        state: { type: String },
        pin: { type: String },
        site_contact: { type: String },
        site_phone: { type: String },
      },
      when: { type: String },
      approved_at: { type: Date },
      approved_by: {
        user_id: { type: mongoose.Schema.Types.Mixed },
        user_name: { type: String },
        role: { type: String },
      },
      approval_method: { type: String }, // "WhatsApp", "Email", "Verbal", "Written / PO", "Screenshot", "Client Link (Direct)"
      approval_notes: { type: String },
      re_request_reason: { type: String }, // "address_change" | "client_revision" | "re_estimate"
      re_request_notes: { type: String },
      approval_history: [
        {
          revision: { type: Number },
          amount: { type: Number },
          carrier: { type: String },
          payer: { type: String },
          courier_partner: { type: String },
          address_snapshot: {
            label: { type: String },
            full_address: { type: String },
            city: { type: String },
            state: { type: String },
            pin: { type: String },
            site_contact: { type: String },
            site_phone: { type: String },
          },
          when: { type: String },
          approved_at: { type: Date },
          approved_by: {
            user_id: { type: mongoose.Schema.Types.Mixed },
            user_name: { type: String },
            role: { type: String },
          },
          approval_method: { type: String },
          approval_notes: { type: String },
          quoted_at: { type: Date },
          quoted_by: {
            user_id: { type: mongoose.Schema.Types.Mixed },
            user_name: { type: String },
          },
          re_request_reason: { type: String },
          re_request_notes: { type: String },
          invalidated_at: { type: Date },
          invalidated_by: {
            user_id: { type: mongoose.Schema.Types.Mixed },
            user_name: { type: String },
          },
        },
      ],
    },

    // Step 6: Commercials & Financial Ledger
    financials: { type: mongoose.Schema.Types.Mixed },

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
      default: "enquiry",
    },
    production_status: {
      type: String,
      enum: ["pending", "pushed", "process", "in_production", "complete", "completed", "on_hold", "cancelled"],
      default: "pending",
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

    // Sample rates approval status
    sample_rates_approved: { type: Boolean, default: false },

    // JSON blob preserving complete React UI State for lossless restoration
    wizard_state: { type: Object },

    created_by: { type: mongoose.Schema.Types.Mixed },
    updated_by: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

// Query optimization indexes for Jobs Board, pagination, and client stats
enquiryFlowIntegrationSchema.index({ createdAt: -1 });
enquiryFlowIntegrationSchema.index({ seq: -1 });
enquiryFlowIntegrationSchema.index({ stage: 1, is_lost: 1 });
enquiryFlowIntegrationSchema.index({ customer_id: 1, is_lost: 1 });
enquiryFlowIntegrationSchema.index({ assigned_to: 1 });
enquiryFlowIntegrationSchema.index({ created_by: 1 });
enquiryFlowIntegrationSchema.index({ coordinator_name: 1 });
enquiryFlowIntegrationSchema.index({ "sub_jobs.sub_job_no": 1 });
enquiryFlowIntegrationSchema.index({ "the_ask.product_name": 1 });
enquiryFlowIntegrationSchema.index({ "delivery_charges.status": 1 });

// Mongoose model mapped explicitly to the new collection "enquiry_flows_integration"
export default mongoose.model("enquiry_flow_integration", enquiryFlowIntegrationSchema, "enquiry_flows_integration");
