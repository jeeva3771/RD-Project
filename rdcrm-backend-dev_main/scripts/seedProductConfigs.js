// Seed Product Configurations matching Ronald D'Souza dev spec v2 (RD Job Flow prototype)
// Contains complete sizes, quantities, approximate rates, routes, and design fields.

export const CONSTRUCTIONS = [
  { name: "13x11 CNC", icon: "🔲" },
  { name: "CNC with a solid base", icon: "🧱" },
  { name: "Plaque with a stud", icon: "📍" },
  { name: "Composite with a solid base", icon: "🏛️" },
  { name: "Composite with single step", icon: "🪜" },
  { name: "Composite with double step", icon: "🪜" },
  { name: "Self-standing block", icon: "🧊" },
  { name: "Fibre frame", icon: "🖼️" },
  { name: "Medal", icon: "🥇" },
  { name: "Clear acrylic with hollow LED base", icon: "💡" },
  { name: "3D figurine with solid base", icon: "🗿" },
  { name: "Shadow box (3D object)", icon: "🗃️" }
];

export const ATTACHMENTS = [
  { name: "Butterfly clutch", type: "pin_backing" },
  { name: "Magnet", type: "pin_backing" },
  { name: "Rubber clutch", type: "pin_backing" },
  { name: "Locking clutch", type: "pin_backing" },
  { name: "Safety pin", type: "pin_backing" }
];

export const PLATINGS = [
  { name: "Gold", type: "metal_plating" },
  { name: "Silver", type: "metal_plating" },
  { name: "Bronze", type: "metal_plating" },
  { name: "Antique gold", type: "metal_plating" },
  { name: "Antique silver", type: "metal_plating" },
  { name: "Antique bronze", type: "metal_plating" },
  { name: "Dual-tone", type: "metal_plating" },
  { name: "Chrome", type: "metal_plating" },
  { name: "Copper", type: "metal_plating" },
  { name: "Rose gold", type: "metal_plating" },
  { name: "Black antique", type: "metal_plating" },
  { name: "Rhodium", type: "metal_plating" },
  { name: "Gunmetal", type: "metal_plating" }
];

export const PROCESSES = [
  { name: "Photo laminated", type: "metal_process" },
  { name: "Etched + colour fill", type: "metal_process" },
  { name: "Etched + colour fill + photo laminated", type: "metal_process" },
  { name: "Soft enamel", type: "metal_process" },
  { name: "Die struck", type: "metal_process" },
  { name: "Zinc die-cast", type: "metal_process" },
  { name: "Hard enamel", type: "metal_process" },
  { name: "Epoxy", type: "metal_process" }
];

export const PRODUCTS = [
  // 1. Custom Trophy
  {
    product_id: "trophy",
    name: "Custom Trophy",
    icon: "🏆",
    sub_label: "Height",
    sort_order: 1,
    is_active: true,
    has_sub_types: false,
    route_config: {
      route: "Partly in-house",
      moq: "MOQ 1 pcs",
      sample_time: "Sample in 2 working days",
      note: "Bhawani Casting, Rahool Casting, Adiraj Laser + others"
    },
    size_config: {
      size_mode: "custom_1d",
      size_row_title: "Size",
      size_row_subtitle: "Height in inches",
      preset_sizes: [
        { label: '6"', value: "6", is_usual: false },
        { label: '8"', value: "8", is_usual: true },
        { label: '10"', value: "10", is_usual: false },
        { label: '12"', value: "12", is_usual: false },
        { label: '14"', value: "14", is_usual: false },
        { label: '16"', value: "16", is_usual: false },
        { label: '18"', value: "18", is_usual: false }
      ],
      allow_custom: true,
      default_size: '8"',
      default_dimensions: { d1: "8", d2: "", unit: "in" },
      preset_quantities: [10, 25, 50, 100, 250, 500],
      default_qty: 50,
      default_budget: 850,
      budget_subtitle: "What the client expects",
      default_design_options: 2
    },
    presets: [
      { label: '10" Acrylic Star on MDF', specs: { size: 10, mat: "Acrylic", base: "Solid MDF" }, budget: 1200 },
      { label: '8" Fusion Trophy', specs: { size: 8, mat: "MDF", base: "Wood" }, budget: 850 }
    ],
    spec_line_template: "{theme} · {type} · {size} · {material}"
  },

  // 2. Plaque
  {
    product_id: "plaque",
    name: "Plaque",
    icon: "🪧",
    sub_label: "L × B",
    sort_order: 2,
    is_active: true,
    has_sub_types: false,
    route_config: {
      route: "Partly in-house",
      moq: "MOQ 1 pcs",
      sample_time: "Sample in 2 working days",
      note: "Creations, Woodcraft, Gurus, Faizan, Mustaqin (MDF)"
    },
    size_config: {
      size_mode: "custom_2d",
      size_row_title: "Size",
      size_row_subtitle: "L × B in inches",
      dimensions: [
        {
          key: "length",
          label: "Length",
          unit: "in",
          allow_custom: true,
          default_value: "9",
          preset_sizes: [
            { label: '7"', value: "7", is_usual: false },
            { label: '8"', value: "8", is_usual: false },
            { label: '9"', value: "9", is_usual: true },
            { label: '10"', value: "10", is_usual: false },
            { label: '12"', value: "12", is_usual: false },
          ],
        },
        {
          key: "breadth",
          label: "Breadth",
          unit: "in",
          allow_custom: true,
          default_value: "7",
          preset_sizes: [
            { label: '5"', value: "5", is_usual: false },
            { label: '6"', value: "6", is_usual: false },
            { label: '7"', value: "7", is_usual: true },
            { label: '10"', value: "10", is_usual: false },
            { label: '12"', value: "12", is_usual: false },
            { label: '14"', value: "14", is_usual: false },
          ],
        },
      ],
      preset_sizes: [],
      allow_custom: true,
      default_size: "9×7",
      default_dimensions: { d1: "9", d2: "7", unit: "in" },
      preset_quantities: [10, 25, 50, 100, 250, 500],
      default_qty: 25,
      default_budget: 750,
      budget_subtitle: "What the client expects",
      default_design_options: 2
    },
    presets: [
      { label: '8×10" Gold Mirror Acrylic', specs: { size: "8×10", mat: "Mirror acrylic", colour: "Gold", thk: 5 }, budget: 950 },
      { label: '9×7" Wooden Plaque with Stud', specs: { size: "9×7", mat: "Wood", colour: "Wood-finish laminate", thk: 12 }, budget: 750 }
    ],
    spec_line_template: "Plaque · {shape} · {size} · {material} {thk}mm · {deco}"
  },

  // 3. Medal (MS Punched & Zinc Cast)
  {
    product_id: "medal",
    name: "Medal",
    icon: "🥇",
    sub_label: "MS punched / Zinc cast",
    sort_order: 3,
    is_active: true,
    has_sub_types: true,
    sub_types: [
      {
        sub_id: "medal_ms",
        label: "MS Punched Medal",
        icon: "🥇",
        sub_text: "Diameter · max 2.5\"",
        sort_order: 1,
        is_active: true
      },
      {
        sub_id: "medal_zinc",
        label: "Zinc Cast Medal",
        icon: "🏅",
        sub_text: "Largest dimension · 1.25\" to 6\"",
        sort_order: 2,
        is_active: true
      }
    ],
    route_config: {
      route: "Outsourced",
      moq: "MOQ 10 pcs",
      sample_time: "Sample in 5 working days",
      note: "Al Barrah Medals, Noor Medals"
    },
    size_config: {
      size_mode: "custom_1d",
      size_row_title: "Diameter",
      size_row_subtitle: "MS: max 2.5\" · Zinc: 1.25\"–6\"",
      preset_sizes: [
        { label: '1.25"', value: "1.25", is_usual: false },
        { label: '1.5"', value: "1.5", is_usual: false },
        { label: '1.75"', value: "1.75", is_usual: false },
        { label: '2"', value: "2", is_usual: true },
        { label: '2.25"', value: "2.25", is_usual: false },
        { label: '2.5"', value: "2.5", is_usual: false },
        { label: '2.75"', value: "2.75", is_usual: false },
        { label: '3"', value: "3", is_usual: false },
        { label: '3.5"', value: "3.5", is_usual: false },
        { label: '4"', value: "4", is_usual: false },
        { label: '5"', value: "5", is_usual: false },
        { label: '6"', value: "6", is_usual: false }
      ],
      allow_custom: true,
      default_size: '2"',
      default_dimensions: { d1: "2", d2: "", unit: "in" },
      preset_quantities: [25, 50, 100, 200, 250, 500],
      default_qty: 100,
      default_budget: 120,
      budget_subtitle: "What the client expects",
      default_design_options: 2,
      has_colour_wise_qty: true
    },
    presets: [
      { label: '2" MS Punched Round (30g)', specs: { medalType: "ms_punched", dia: '2"', wt: 30, sides: "single" }, budget: 120 },
      { label: '2.5" Zinc Die-cast Both Sides', specs: { medalType: "zinc_cast", dia: '2.5"', wt: 55, sides: "both" }, budget: 280 }
    ],
    spec_line_template: "Medal · {sub_type} · {size} · {finish} · {ribbon}"
  },

  // 4. Frame
  {
    product_id: "frame",
    name: "Frame",
    icon: "🖼️",
    sub_label: "A-series or L × B",
    sort_order: 4,
    is_active: true,
    has_sub_types: false,
    route_config: {
      route: "Outsourced",
      moq: "MOQ 1 pcs",
      sample_time: "Sample in 2 working days",
      note: "Sun Frames, Hatim Bhai"
    },
    size_config: {
      size_mode: "custom_2d",
      size_row_title: "Content size",
      size_row_subtitle: "A-series or L × B in inches",
      preset_sizes: [
        { label: "A5", value: "A5", is_usual: false },
        { label: "A4", value: "A4", is_usual: true },
        { label: "A3", value: "A3", is_usual: false },
        { label: "A2", value: "A2", is_usual: false },
        { label: "4×6", value: "4×6", is_usual: false },
        { label: "5×7", value: "5×7", is_usual: false },
        { label: "6×8", value: "6×8", is_usual: false },
        { label: "8×10", value: "8×10", is_usual: false },
        { label: "8×12", value: "8×12", is_usual: false },
        { label: "10×12", value: "10×12", is_usual: false },
        { label: "12×15", value: "12×15", is_usual: false },
        { label: "12×18", value: "12×18", is_usual: false },
        { label: "16×20", value: "16×20", is_usual: false }
      ],
      allow_custom: true,
      default_size: "A4",
      default_dimensions: { d1: "8.3", d2: "11.7", unit: "in" },
      preset_quantities: [25, 50, 100, 120, 250, 500],
      default_qty: 120,
      default_budget: 430,
      budget_subtitle: "What the client expects",
      default_design_options: 2
    },
    presets: [
      {
        label: "A4 certificate frame",
        specs: { size: "A4", ftype: "Certificate frame", glazing: "Acrylic 2 mm", mount: "None", print: "RD arranges printing", paper: "250 gsm art card" },
        budget: 430
      },
      {
        label: "A3 certificate frame",
        specs: { size: "A3", ftype: "Certificate frame", glazing: "Acrylic 2 mm", mount: "None", print: "RD arranges printing", paper: "250 gsm art card" },
        budget: 650
      }
    ],
    spec_line_template: "Frame · {size} · {mWidth}\" moulding · {glazing} · {mount}"
  },

  // 5. Lapel Pin
  {
    product_id: "lapel_pin",
    name: "Lapel Pin",
    icon: "📌",
    sub_label: "Min 0.75\"",
    sort_order: 5,
    is_active: true,
    has_sub_types: false,
    route_config: {
      route: "Partly in-house",
      moq: "MOQ 25 pcs",
      sample_time: "Sample in 5 working days",
      note: "Etching in-house or outside; soldering and plating outside"
    },
    size_config: {
      size_mode: "custom_1d",
      size_row_title: "Size",
      size_row_subtitle: "Min 0.75\"",
      preset_sizes: [
        { label: '0.75"', value: "0.75", is_usual: false },
        { label: '1"', value: "1", is_usual: false },
        { label: '1.25"', value: "1.25", is_usual: false },
        { label: '1.5"', value: "1.5", is_usual: true },
        { label: '2"', value: "2", is_usual: false }
      ],
      allow_custom: true,
      default_size: '1.5"',
      default_dimensions: { d1: "1.5", d2: "", unit: "in" },
      preset_quantities: [25, 50, 100, 250, 500, 1000],
      default_qty: 25,
      default_budget: 120,
      budget_subtitle: "What the client expects",
      default_design_options: 2,
      has_colour_wise_qty: true
    },
    presets: [
      { label: 'Photo laminated 1.5" butterfly', specs: { size: '1.5"', process: "Photo laminated", back: "Butterfly clutch" }, budget: 100 },
      { label: 'Etched + colour fill 1.5" magnet', specs: { size: '1.5"', process: "Etched + colour fill", back: "Magnet", colours: 3 }, budget: 120 },
      { label: 'Etched + colour fill + photo laminated 1.5"', specs: { size: '1.5"', process: "Etched + colour fill + photo laminated", back: "Butterfly clutch" }, budget: 135 }
    ],
    spec_line_template: "Lapel Pin · {size} · {process} · {shape} · {plating} · {back}"
  },

  // 6. Badge (Name, Emblem, Button)
  {
    product_id: "badge",
    name: "Badge",
    icon: "🪪",
    sub_label: "Name / Emblem / Button badge",
    sort_order: 6,
    is_active: true,
    has_sub_types: true,
    sub_types: [
      { sub_id: "badge_name", label: "Name Badge", icon: "🪪", sub_text: "Max 3\"", sort_order: 1, is_active: true },
      { sub_id: "badge_button", label: "Button Badge", icon: "🔘", sub_text: "Diameter 33–56 mm", sort_order: 2, is_active: true },
      { sub_id: "badge_emblem", label: "Logo / Emblem Badge", icon: "🛡️", sub_text: "Custom entry only", sort_order: 3, is_active: true }
    ],
    route_config: {
      route: "Partly in-house",
      moq: "MOQ 10 pcs",
      sample_time: "Sample in 2 working days",
      note: "MDF or acrylic by workload; plating outside"
    },
    size_config: {
      size_mode: "custom_1d",
      size_row_title: "Size",
      size_row_subtitle: "Diameter or width",
      preset_sizes: [
        { label: "33 mm", value: "33 mm", is_usual: false },
        { label: "44 mm", value: "44 mm", is_usual: false },
        { label: "56 mm", value: "56 mm", is_usual: false },
        { label: '2"', value: '2"', is_usual: true }
      ],
      allow_custom: true,
      default_size: '2"',
      default_dimensions: { d1: "2", d2: "", unit: "in" },
      preset_quantities: [25, 50, 100, 250, 500],
      default_qty: 50,
      default_budget: 100,
      budget_subtitle: "What the client expects",
      default_design_options: 2,
      has_colour_wise_qty: true
    },
    presets: [
      { label: 'Gold mirror acrylic 2", pin', specs: { badgeType: "name", size: '2"', material: "Mirror acrylic", fix: "Pin", deco: "Laser engraving" }, budget: 100 },
      { label: 'Aluminium 2", magnet', specs: { badgeType: "name", size: '2"', material: "Aluminium", fix: "Magnet", deco: "UV print" }, budget: 120 },
      { label: "UV printed acrylic 56 mm, pin", specs: { badgeType: "name", size: "56 mm", material: "White acrylic", fix: "Pin", deco: "UV print" }, budget: 100 }
    ],
    spec_line_template: "Badge · {sub_type} · {size} · {material} · {fix}"
  },

  // 7. Cufflinks
  {
    product_id: "cufflinks",
    name: "Cufflinks",
    icon: "🔗",
    sub_label: "Face size · sold in pairs",
    sort_order: 7,
    is_active: true,
    has_sub_types: false,
    route_config: {
      route: "Outsourced",
      moq: "MOQ 10 pairs",
      sample_time: "Sample in 5 working days",
      note: "Al Barrah Medals, Pradeep"
    },
    size_config: {
      size_mode: "fixed_sizes_only",
      uom: "pair",
      qty_title: "Quantities to price (pairs)",
      qty_subtitle: "Enter in pairs (pieces = pairs × 2)",
      rate_title: "Approx. rate per pair",
      size_row_title: "Face size",
      size_row_subtitle: "Sold in pairs (pairs × 2)",
      preset_sizes: [
        { label: "18 mm", value: "18 mm", is_usual: true }
      ],
      allow_custom: false,
      default_size: "18 mm",
      default_dimensions: { d1: "18", d2: "", unit: "mm" },
      preset_quantities: [10, 25, 50, 100, 250],
      default_qty: 50,
      default_budget: 520,
      budget_subtitle: "What the client expects",
      default_design_options: 2
    },
    presets: [
      { label: "Gold, hard enamel, velvet pouch", specs: { size: "18 mm", plating: "Gold", deco: "Hard enamel", pack: "Velvet pouch" }, budget: 520 },
      { label: "Silver, engraved, branded box", specs: { size: "18 mm", plating: "Silver", deco: "Engraving", pack: "Branded box (logo on lid)" }, budget: 520 }
    ],
    spec_line_template: "Cufflinks · {size} · {plating} · {deco} · {pack}"
  },

  // 8. Tie Bar
  {
    product_id: "tie_pin",
    name: "Tie Bar",
    icon: "👔",
    sub_label: "Length · tie bars only",
    sort_order: 8,
    is_active: true,
    has_sub_types: false,
    route_config: {
      route: "Outsourced",
      moq: "MOQ 10 pcs",
      sample_time: "Sample in 5 working days",
      note: "Al Barrah Medals, Pradeep"
    },
    size_config: {
      size_mode: "fixed_sizes_only",
      size_row_title: "Length",
      size_row_subtitle: "Tie bars only",
      preset_sizes: [
        { label: '1.5"', value: "1.5", is_usual: false },
        { label: '2"', value: "2", is_usual: false },
        { label: '2.25"', value: "2.25", is_usual: true },
        { label: '2.5"', value: "2.5", is_usual: false }
      ],
      allow_custom: false,
      default_size: '2.25"',
      default_dimensions: { d1: "2.25", d2: "", unit: "in" },
      preset_quantities: [10, 25, 50, 100, 250],
      default_qty: 50,
      default_budget: 380,
      budget_subtitle: "What the client expects",
      default_design_options: 2
    },
    presets: [
      { label: '2.25" gold, engraved logo', specs: { size: '2.25"', plating: "Gold", deco: "Engraving", wid: "6 mm" }, budget: 380 },
      { label: '1.5" slim, silver', specs: { size: '1.5"', plating: "Silver", wid: "5 mm" }, budget: 340 }
    ],
    spec_line_template: "Tie Bar · {size} · {wid} · {plating} · {clasp}"
  },

  // 9. Fridge Magnet
  {
    product_id: "fridge_magnet",
    name: "Fridge Magnet",
    icon: "🧲",
    sub_label: "L × B",
    sort_order: 9,
    is_active: true,
    has_sub_types: false,
    route_config: {
      route: "Partly in-house",
      moq: "MOQ 10 pcs",
      sample_time: "Sample in 2 working days",
      note: "Laser Studio; paper print offset / digital, UV Print Studio"
    },
    size_config: {
      size_mode: "custom_2d",
      size_row_title: "Size",
      size_row_subtitle: "L × B in inches",
      preset_sizes: [
        { label: "2×2", value: "2×2", is_usual: false },
        { label: "2.5×2.5", value: "2.5×2.5", is_usual: false },
        { label: "3×3", value: "3×3", is_usual: true },
        { label: "4×4", value: "4×4", is_usual: false }
      ],
      allow_custom: true,
      default_size: "3×3 in",
      default_dimensions: { d1: "3", d2: "3", unit: "in" },
      preset_quantities: [25, 50, 100, 250, 500],
      default_qty: 50,
      default_budget: 45,
      budget_subtitle: "What the client expects",
      default_design_options: 2
    },
    presets: [
      {
        label: "Printed paper on 3 mm MDF, gloss lam, magnetic sheet",
        specs: { size: "3×3 in", build: "Paper laminated on MDF", printM: "Offset printing", lam: "Gloss lamination", thkL: 3, magnet: "Magnetic sheet" },
        budget: 40
      },
      {
        label: "Printed paper on 3 mm MDF, matt lam, magnet button",
        specs: { size: "3×3 in", build: "Paper laminated on MDF", printM: "Digital printing", lam: "Matt lamination", thkL: 3, magnet: "Ferrite button" },
        budget: 42
      },
      {
        label: 'Acrylic 3" direct UV, magnetic sheet',
        specs: { size: "3×3 in", build: "Direct print / engrave", material: "Acrylic", thk: 3, deco: ["Front UV"], magnet: "Magnetic sheet" },
        budget: 45
      }
    ],
    spec_line_template: "Fridge Magnet · {size} · {build} · {shape} · {magnet}"
  },

  // 10. Flag Stand
  {
    product_id: "flagstand",
    name: "Flag Stand",
    icon: "🚩",
    sub_label: "Desk stands 8–18\"",
    sort_order: 10,
    is_active: true,
    has_sub_types: false,
    route_config: {
      route: "Partly in-house",
      moq: "MOQ 1 pcs",
      sample_time: "Sample in 3 working days",
      note: "Base in-house; poles, finials and flags bought in"
    },
    size_config: {
      size_mode: "custom_1d",
      size_row_title: "Pole height",
      size_row_subtitle: "Desk stands 8–18\"",
      preset_sizes: [
        { label: '8"', value: "8", is_usual: false },
        { label: '10"', value: "10", is_usual: true },
        { label: '12"', value: "12", is_usual: false },
        { label: '15"', value: "15", is_usual: false },
        { label: '18"', value: "18", is_usual: false }
      ],
      allow_custom: true,
      default_size: '10"',
      default_dimensions: { d1: "10", d2: "", unit: "in" },
      preset_quantities: [1, 5, 10, 25, 50, 100],
      default_qty: 10,
      default_budget: 340,
      budget_subtitle: "What the client expects",
      default_design_options: 2
    },
    presets: [
      {
        label: "Single desk flag, acrylic base",
        specs: { size: '10"', ftype: "Single flag", baseMat: "Acrylic", pole: "Chrome metal", finial: "Ball", flagMat: "Satin" },
        budget: 340
      },
      {
        label: "Double cross flag, wooden base",
        specs: { size: '10"', ftype: "Double (cross)", baseMat: "Wood", pole: "Gold metal", finial: "Spear", flagMat: "Satin" },
        budget: 480
      }
    ],
    spec_line_template: "Flag Stand · {size} · {ftype} · {baseMat} base · {pole} pole"
  },

  // 11. Coasters
  {
    product_id: "coaster",
    name: "Coasters",
    icon: "☕",
    sub_label: "Sold in sets",
    sort_order: 11,
    is_active: true,
    has_sub_types: false,
    route_config: {
      route: "Partly in-house",
      moq: "MOQ 10 sets",
      sample_time: "Sample in 2 working days",
      note: "Laser Studio; paper print offset / digital, UV Print Studio"
    },
    size_config: {
      size_mode: "custom_1d",
      size_row_title: "Diameter / side",
      size_row_subtitle: "Sold in sets",
      preset_sizes: [
        { label: '3.5"', value: "3.5", is_usual: false },
        { label: '4"', value: "4", is_usual: true },
        { label: "4×4 sq", value: "4×4", is_usual: false }
      ],
      allow_custom: true,
      default_size: '4"',
      default_dimensions: { d1: "4", d2: "", unit: "in" },
      preset_quantities: [10, 25, 50, 100, 250],
      default_qty: 25,
      default_budget: 140,
      budget_subtitle: "What the client expects",
      default_design_options: 2
    },
    presets: [
      {
        label: "Set of 4 · printed paper on 4 mm MDF, gloss lam, set box",
        specs: { size: '4"', build: "Paper laminated on MDF", printM: "Offset printing", lam: "Gloss lamination", thkL: 4, perSet: 4, setBox: "Printed box for the set", backing: "Cork base" },
        budget: 140
      },
      {
        label: "Set of 2 · printed paper on 4 mm MDF, matt lam, set box",
        specs: { size: '4"', build: "Paper laminated on MDF", printM: "Digital printing", lam: "Matt lamination", thkL: 4, perSet: 2, setBox: "Printed box for the set", backing: "Felt base" },
        budget: 140
      },
      {
        label: "Set of 6 · acrylic direct UV with holder",
        specs: { size: '4"', build: "Direct print / engrave", material: "Acrylic", thk: 5, perSet: 6, deco: ["UV print"], setBox: "Acrylic holder", backing: "Anti-skid pads" },
        budget: 380
      }
    ],
    spec_line_template: "Coaster · {size} · {build} · {shape} · {perSet} per set"
  },

  // 12. Scroll
  {
    product_id: "scroll",
    name: "Scroll",
    icon: "📜",
    sub_label: "Citation · felicitation",
    sort_order: 12,
    is_active: true,
    has_sub_types: false,
    route_config: {
      route: "Partly in-house",
      moq: "MOQ 1 pcs",
      sample_time: "Sample in 2 working days",
      note: "Digital printing in-house; rods & casing sourced"
    },
    size_config: {
      size_mode: "custom_2d",
      size_row_title: "Scroll sheet size",
      size_row_subtitle: "A4, A3 or custom L × B",
      preset_sizes: [
        { label: "A4", value: "A4", is_usual: true },
        { label: "A3", value: "A3", is_usual: false },
        { label: "10×14", value: "10×14", is_usual: false },
        { label: "12×18", value: "12×18", is_usual: false },
      ],
      allow_custom: true,
      default_size: "A4",
      default_dimensions: { d1: "8.3", d2: "11.7", unit: "in" },
      preset_quantities: [10, 25, 50, 100, 250],
      default_qty: 25,
      default_budget: 350,
      budget_subtitle: "What the client expects",
      default_design_options: 2
    },
    presets: [
      {
        label: "Velvet scroll with brass rods, A4",
        specs: { size: "A4", stype: "Velvet / cloth scroll", contentBy: "Digital print", casing: "Velvet tube" },
        budget: 450
      },
      {
        label: "Paper scroll, wooden rods, tube",
        specs: { size: "A4", stype: "Parchment paper scroll", contentBy: "Digital print", casing: "Scroll tube" },
        budget: 280
      }
    ],
    spec_line_template: "Scroll · {size} · {stype} · {orientation} · {casing}"
  }
];

