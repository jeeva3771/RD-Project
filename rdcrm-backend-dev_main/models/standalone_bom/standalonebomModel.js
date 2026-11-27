import mongoose from "mongoose";

const bomSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true, unique: true },
    // enquiry_id: { type: mongoose.ObjectId, ref: "enquiry"},
    job_no: { type: String },
    sub_job_no: { type: String, required: true },
    sales_order_nanoid: { type: String },
    product_name: { type: String },
    job_quantity: { type: Number },
    jobDescription: { type: String },

    org_image: { type: String },
    is_bom_draft: { type: Boolean, default: false },
    draft_step: { type: Number, default: 0 },

    quotation_pdf: [{ type: String }],

    totalUnitCost: { Number: String },

    totalJobCost: { Number: String },

    jobsheetfiles: { type: String },
    quoatationfiles: { type: String },



    items: [
      {
        item_id: { type: String },
        type: { type: String },
        subCategoryId: { type: String },
        itemName: { type: String },
        itemType: { type: String },
        stockSizes: [String],
        master: { type: String },
        category_type: { type: String },
        secondarycategory: { type: String },
        alias: { type: String },
        color: { type: String },
        rate: { type: String },
        length: { type: String },
        width: { type: String },
        height: { type: String },
        thickness: { type: String },
        vendorName: { type: String },
        rateUnit: { type: String },
        unit: { type: String },
        is_inventory_item: { type: Boolean, default: false },
      },
    ],


    // Materials
    material_specification: [
      {
        material_id: { type: mongoose.ObjectId, ref: "item" },
        item_id: { type: String },
        material_name: { type: String },
        material_type: { type: String },
        category_type: { type: String },
        alias: { type: String },
        color: { type: String },
        input: {
          size: String,
          ups: Number,
          one_up_length: Number,
          one_up_width: Number,
          quantity: Number,
          unit: String,
        },
        wastage: {
          value: { type: Number, required: true },
          type: { type: String, required: true }
        },
        final_total: Number,
        rate: String,
        unitRate: Number,
        jobTotal: Number,
        is_inventory_item: { type: Boolean, default: false },
      },
    ],


    // Grouping of materials
    material_groups: [
      {
        group_id: String,
        group_name: String,
        materials: [
          {
            material_id: { type: mongoose.ObjectId, ref: "item" },
            item_id: { type: String },
            material_name: String,
            material_type: String,
            category_type: { type: String },
            alias: String,
            color: String,
            input: {
              size: String,
              ups: Number,
              one_up_length: Number,
              one_up_width: Number,
              quantity: Number,
              unit: String,
            },
            wastage: {
              value: { type: Number, required: true },
              type: { type: String, required: true }
            },
            final_total: Number,
            rate: String,
            vendorName: String,
            is_inventory_item: { type: Boolean, default: false },
          },
        ],
      },
    ],


    // Processes for materials
    materialprocess: [
      {
        material_group_id: String,
        material_group_name: String,
        material_total: Number,
        material_unit: String,
        material_input: {
          size: String,
          ups: Number,
          one_up_length: Number,
          one_up_width: Number,
          quantity: Number,
          unit: String,
        },
        processes: [
          {
            process_id: String,
            process_name: String,
            department: String,
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
            unitRate: Number,
            jobTotal: Number,
            process_index: String,
            row_type: String,
            outsource_rate: Number,
            inhouse: String,
            current_total_material: Number,
            job_metric: Number,
            order_qty: Number,
            prompt: String,
          },
        ],
      },
    ],

    // Packing data
    packingdatas: [
      {
        itemId: { type: mongoose.ObjectId, ref: "item" },
        name: String,
        itemType: String,
        unitCost: Number,
        logicalRate: [
          {
            variable: String,
            price: Number,
          },
        ],
        qty: String,
        logic1: String,
        logic2: String,
        logic3: String,
        total: Number,
        finaltotal: Number,
        jobTotal: Number,
      },
    ],

    // Cost details
    costdetails: {
      materialSpecification: [
        {
          material_id: { type: mongoose.ObjectId, ref: "item" },
          item_id: { type: String },
          material_name: String,
          material_type: String,
          category_type: { type: String },
          alias: String,
          color: String,
          input: Object,
          wastage: Object,
          final_total: Number,
          rate: String,
          unitRate: Number,
          jobTotal: Number,
          is_inventory_item: { type: Boolean, default: false },
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
              unitRate: Number,
              jobTotal: Number,
              prompt: String,
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

    jobSheet: {
      materialSpecification: [
        {
          material_id: { type: mongoose.ObjectId, ref: "item" },
          material_name: String,
          material_type: String,
          category_type: { type: String },
          alias: String,
          color: String,
          input: Object,
          wastage: Object,
          final_total: Number,
          rate: String,
          unitRate: Number,
          jobTotal: Number,
          is_inventory_item: { type: Boolean, default: false },
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


    quotation: {
      margin: String,
      marginType: String,
      finalUnitPrice: Number,
      finalJobPrice: Number,
      gstRate: String,
    },

    artwork_pdf: { type: String },
    artwork_cdr: { type: String },

    is_active: { type: Boolean, default: true },
    created_by: { type: mongoose.ObjectId, ref: "users", required: true },
    created_at: { type: String, required: true },
    updated_by: [
      {
        user: { type: mongoose.ObjectId, ref: "users" },
        date: String,
      },
    ],
    updated_at: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("standalone_bom", bomSchema);
