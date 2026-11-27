import { calculateDynamicEstimate } from "../../../../utils/trophyMasterService";
import { generateSpecLine } from "../../../../utils/specLineGenerator";

export const PRODUCT_ROUTES = {
  trophy: {
    route: "Partly in-house",
    moq: "MOQ 1 pcs",
    sampleTime: "Sample in 2 working days",
    note: "Costing decides in-house / outsource / split for each job. Sample and a client-approved digital proof are mandatory.",
  },
  plaque: {
    route: "Partly in-house",
    moq: "MOQ 1 pcs",
    sampleTime: "Sample in 2 working days",
    note: "Costing decides in-house / outsource / split for each job. Sample and a client-approved digital proof are mandatory.",
  },
  medal: {
    route: "Outsourced",
    moq: "MOQ 10 pcs",
    sampleTime: "Sample in 5 working days",
    note: "Vendors: Al Barrah Medals, Noor Medals. Die-punched MS or die-cast Zinc.",
  },
  frame: {
    route: "Outsourced",
    moq: "MOQ 1 pcs",
    sampleTime: "Sample in 2 working days",
    note: "Costing decides in-house / outsource / split for each job. Samples and a client-approved digital proof are mandatory.",
  },
  lapel_pin: {
    route:
      "Partly in-house (etching in-house or outside; soldering and plating outside)",
    moq: "MOQ 25 pcs",
    sampleTime: "Sample in 5 working days",
    note: "Costing decides in-house / outsource / split for each job. Samples and a client-approved digital proof are mandatory.",
  },
  badge: {
    route: "Partly in-house",
    moq: "MOQ 10 pcs",
    sampleTime: "Sample in 2 working days",
    note: "Name badges in-house (acrylic/MDF); metal emblem badges outsourced.",
  },
  cufflinks: {
    route: "Outsourced",
    moq: "MOQ 10 pairs",
    sampleTime: "Sample in 5 working days",
    note: "Costing decides in-house / outsource / split for each job. Sample and a client-approved digital proof are mandatory.",
  },
  tie_pin: {
    route: "Outsourced",
    moq: "MOQ 10 pcs",
    sampleTime: "Sample in 5 working days",
    note: "Costing decides in-house / outsource / split for each job. Sample and a client-approved digital proof are mandatory.",
  },
  fridge_magnet: {
    route:
      "Partly in-house (Laser Studio; paper print offset / digital, UV Print Studio for direct print)",
    moq: "MOQ 10 pcs",
    sampleTime: "Sample in 2 working days",
    note: "Costing decides in-house / outsource / split for each job. Sample and a client-approved digital proof are mandatory.",
  },
  flagstand: {
    route:
      "Partly in-house (base in-house; poles, finials and flags bought in)",
    moq: "MOQ 1 pcs",
    sampleTime: "Sample in 3 working days",
    note: "Costing decides in-house / outsource / split for each job. Sample and a client-approved digital proof are mandatory.",
  },
  coaster: {
    route:
      "Partly in-house (Laser Studio; paper print offset / digital, UV Print Studio for direct print)",
    moq: "MOQ 10 sets",
    sampleTime: "Sample in 2 working days",
    note: "Costing decides in-house / outsource / split for each job. Sample and a client-approved digital proof are mandatory.",
  },
  scroll: {
    route: "Partly in-house",
    moq: "MOQ 1 pcs",
    sampleTime: "Sample in 2 working days",
    note: "Costing decides in-house / outsource / split for each job. Sample and a client-approved digital proof are mandatory.",
  },
};

export const mapTypeNameToProductType = (typeName) => {
  if (!typeName) return null;
  const norm = String(typeName || "")
    .toLowerCase()
    .trim();
  if (!norm) return null;
  if (norm.includes("plaque")) return "plaque";
  if (norm.includes("medal")) return "medal";
  if (norm.includes("frame")) return "frame";
  if (norm.includes("pin") && !norm.includes("tie")) return "lapel_pin";
  if (norm.includes("badge")) return "badge";
  if (norm.includes("cufflink")) return "cufflinks";
  if (norm.includes("tie")) return "tie_pin";
  if (norm.includes("magnet")) return "fridge_magnet";
  if (norm.includes("flag")) return "flagstand";
  if (norm.includes("coaster")) return "coaster";
  if (norm.includes("scroll")) return "scroll";
  if (
    norm.includes("memento") ||
    norm.includes("cup") ||
    norm.includes("shield") ||
    norm.includes("corporate gift")
  )
    return "memento";
  if (norm.includes("trophy")) return "trophy";
  return null;
};

/**
 * Apply product type selection and defaults.
 * Prioritizes MongoDB ProductConfigMaster configuration dynamically.
 */
export const applyProductTypeDefaults = (
  grp,
  newType,
  labelText,
  specPatch,
  activeProdConfig,
  ptObj,
  materials = [],
  elements = []
) => {
  grp.productType = newType;
  grp.type =
    labelText ||
    (activeProdConfig ? activeProdConfig.name : ptObj ? ptObj.label : newType);
  grp.isCustomType = false;
  grp.showCustomTypeInput = false;

  // If switching away from trophy, reset trophy-specific construction / materials / fusion
  if (newType !== "trophy" && newType !== "memento") {
    grp.construction = null;
    grp.mat = null;
    grp.mats = [];
    grp.fusion = [];
    grp.elements = [];
  }

  if (newType === "trophy") {
    grp.mat = grp.mat || "MDF";
    grp.mats = grp.mats && grp.mats.length > 0 ? grp.mats : ["MDF"];
    if (grp.items?.[0]) {
      if (!grp.items[0].qty) grp.items[0].qty = 50;
      if (!grp.items[0].budget) {
        grp.items[0].budget = Number(activeProdConfig?.size_config?.default_budget || 0);
      }
    }
  }

  const isSameSub =
    grp.productType === newType &&
    (specPatch?.subType
      ? grp.designSpec?.subType === specPatch.subType &&
        (specPatch.medalType
          ? grp.designSpec?.medalType === specPatch.medalType
          : true) &&
        (specPatch.badgeType
          ? grp.designSpec?.badgeType === specPatch.badgeType
          : true)
      : true);

  if (!isSameSub) {
    grp.designSpec = { ...(specPatch || {}) };
  } else {
    grp.designSpec = {
      ...(grp.designSpec || {}),
      ...(specPatch || {}),
    };
  }

  // Apply default values from MongoDB activeProdConfig design_fields dynamically
  if (activeProdConfig?.design_fields?.length > 0) {
    const curSub =
      specPatch?.subType ||
      specPatch?.medalType ||
      specPatch?.badgeType ||
      grp.designSpec?.subType;
    activeProdConfig.design_fields.forEach((df) => {
      const isApplicable =
        !df.applicable_sub_types ||
        df.applicable_sub_types.length === 0 ||
        (curSub && df.applicable_sub_types.includes(curSub));
      if (
        isApplicable &&
        df.default_value &&
        grp.designSpec[df.field_key] === undefined
      ) {
        grp.designSpec[df.field_key] = df.default_value;
      }
    });
  }

  // Apply default size, quantity, and budget strictly from MongoDB size_config
  const configuredDims = activeProdConfig?.size_config?.dimensions;
  const hasConfiguredDimensions =
    Array.isArray(configuredDims) && configuredDims.length > 0;

  if (grp.items?.[0]) {
    if (hasConfiguredDimensions) {
      const defaultParts = configuredDims
        .map((d) => {
          const usual = d.preset_sizes?.find((p) => p.is_usual)?.value;
          const first = d.preset_sizes?.[0]?.value;
          return usual || first || d.default_value || "";
        })
        .filter(Boolean);
      const unit = configuredDims[0]?.unit || "in";
      const comp = defaultParts.join("×");
      if (comp) {
        grp.items[0].size = unit === "mm" ? `${comp} mm` : `${comp}"`;
      } else {
        grp.items[0].size = "";
      }
    } else if (activeProdConfig?.size_config?.default_size) {
      grp.items[0].size = activeProdConfig.size_config.default_size;
    } else {
      grp.items[0].size = "";
    }

    if (activeProdConfig?.size_config?.default_qty) {
      grp.items[0].qty = activeProdConfig.size_config.default_qty;
    }
    if (activeProdConfig?.size_config?.default_budget) {
      grp.items[0].budget = activeProdConfig.size_config.default_budget;
    }
  }

  // Product-specific designSpec & size initializations (fallbacks if not defined in master)
  if (newType === "frame") {
    grp.designSpec = {
      frameType: "certificate",
      orient: "portrait",
      mWidth: 1,
      mount: "None",
      glazing: "Acrylic 2 mm",
      stand: "Plastic stand",
      print: "RD arranges printing",
      paper: "250 gsm art card",
      personalisation: [],
      addons: [],
      packaging: [],
      ...grp.designSpec,
      ...(specPatch || {}),
    };
    if (grp.items?.[0]) {
      if (!grp.items[0].qty) grp.items[0].qty = 120;
      if (!grp.items[0].budget) grp.items[0].budget = 430;
    }
  }

  if (newType === "lapel_pin") {
    grp.designSpec = {
      process: "Photo laminated",
      shape: "Round",
      metal: "Brass",
      effect: "None",
      back: "Butterfly clutch",
      posts: 2,
      packaging: [],
      ...grp.designSpec,
      ...(specPatch || {}),
    };
    if (grp.items?.[0]) {
      if (grp.items[0].qty === undefined) grp.items[0].qty = 0;
      if (!grp.items[0].budget) grp.items[0].budget = 100;
      if (!grp.items[0].colourQuantities) {
        grp.items[0].colourQuantities = [];
      }
      grp.items[0].colour = "";
    }
  }

  if (newType === "badge") {
    const bType = specPatch?.badgeType || grp.designSpec?.badgeType || "name";
    grp.designSpec = {
      badgeType: bType,
      material: "White acrylic",
      deco: "UV print",
      fix: "Pin",
      lines: ["Name", "Designation", "Logo"],
      packaging: [],
      process: "Photo laminated",
      shape: "Round",
      metal: "Brass",
      back: "Pin",
      artwork: "Same for all",
      ...grp.designSpec,
      ...(specPatch || {}),
    };
    if (grp.items?.[0]) {
      if (bType === "button") {
        if (!grp.items[0].budget) grp.items[0].budget = 30;
        grp.items[0].colourQuantities = [];
      } else if (bType === "emblem") {
        if (!grp.items[0].budget) grp.items[0].budget = 160;
        grp.items[0].colourQuantities = [];
      } else {
        if (!grp.items[0].budget) grp.items[0].budget = 100;
        grp.items[0].colourQuantities = [];
      }
      if (grp.items[0].qty === undefined) grp.items[0].qty = 0;
      grp.items[0].colour = "";
    }
  }

  if (newType === "cufflinks") {
    grp.designSpec = {
      build: "Custom die (logo)",
      shape: "Round",
      closure: "Bullet back",
      metal: "Brass",
      plating: "Gold",
      deco: "Hard enamel",
      colours: 3,
      box: "",
      ...grp.designSpec,
      ...(specPatch || {}),
    };
    if (grp.items?.[0]) {
      if (!grp.items[0].qty) grp.items[0].qty = 50;
      if (!grp.items[0].budget) grp.items[0].budget = 520;
    }
  }

  if (newType === "tie_pin") {
    grp.designSpec = {
      wid: "6 mm",
      clasp: "Alligator clip",
      deco: "Engraving",
      metal: "Brass",
      plating: "Gold",
      personal: "Off",
      box: "",
      ...grp.designSpec,
      ...(specPatch || {}),
    };
    if (grp.items?.[0]) {
      if (grp.items[0].qty === undefined) grp.items[0].qty = 0;
      if (!grp.items[0].budget) grp.items[0].budget = 380;
    }
  }

  if (newType === "fridge_magnet") {
    grp.designSpec = {
      build: "Paper laminated on MDF",
      paperPrint: "",
      lam: "",
      thk: "",
      cut: "Laser cut to shape",
      shape: "",
      magnet: "Magnetic sheet",
      artwork: "Same on all",
      pack: "",
      ...grp.designSpec,
      ...(specPatch || {}),
    };
    if (grp.items?.[0]) {
      if (grp.items[0].qty === undefined) grp.items[0].qty = 0;
      if (!grp.items[0].budget) grp.items[0].budget = 40;
    }
  }

  if (newType === "flagstand") {
    grp.designSpec = {
      standType: "",
      ftype: "",
      baseMat: "",
      baseShape: "",
      baseBranding: "",
      pole: "",
      finial: "",
      flagFabric: "",
      flagMat: "",
      flagPrint: "",
      flagSize: "",
      flagEdge: "",
      whichFlags: "",
      packaging: "",
      pack: "",
      ...grp.designSpec,
      ...(specPatch || {}),
    };
    if (grp.items?.[0]) {
      if (grp.items[0].qty === undefined) grp.items[0].qty = 0;
      if (!grp.items[0].budget) grp.items[0].budget = 340;
    }
  }

  if (newType === "coaster") {
    grp.designSpec = {
      build: "Paper laminated on MDF",
      paperPrint: "",
      printM: "",
      lam: "",
      thk: "",
      thkL: "",
      cut: "Laser cut to shape",
      shape: "Round",
      perSet: 4,
      artwork: "Same on all",
      backing: "",
      setBox: "",
      outerPack: "",
      ...grp.designSpec,
      ...(specPatch || {}),
    };
    if (grp.items?.[0]) {
      if (grp.items[0].qty === undefined) grp.items[0].qty = 0;
      if (!grp.items[0].budget) grp.items[0].budget = 140;
    }
  }

  if (newType === "scroll") {
    grp.designSpec = {
      scrollType: "",
      stype: "",
      orientation: "Portrait",
      contentBy: "",
      print: "",
      seal: "None",
      personal: "Different name on each",
      casing: "",
      packaging: "",
      pack: "",
      ...grp.designSpec,
      ...(specPatch || {}),
    };
    if (grp.items?.[0]) {
      if (grp.items[0].qty === undefined) grp.items[0].qty = 0;
      if (!grp.items[0].budget) grp.items[0].budget = 250;
    }
  }

  if (Array.isArray(grp.items)) {
    const defaultOptions =
      activeProdConfig?.size_config?.default_design_options !== undefined &&
      activeProdConfig?.size_config?.default_design_options !== null &&
      activeProdConfig?.size_config?.default_design_options !== ""
        ? Number(activeProdConfig.size_config.default_design_options)
        : 2;

    grp.items.forEach((it) => {
      if (!it.spec) it.spec = {};
      if (specPatch) Object.assign(it.spec, specPatch);
      if (specPatch?.dia) it.size = specPatch.dia;
      if (specPatch?.size) it.size = specPatch.size;
      it.designOptions = defaultOptions;
      it.designOptionsCount = defaultOptions;
      it.spec.designOptions = defaultOptions;

      if (Array.isArray(it.colourQuantities)) {
        it.colourQuantities = it.colourQuantities.filter(
          (r) => r && typeof r === "object" && Boolean(r.colour && String(r.colour).trim())
        );
        it.spec.colourQuantities = it.colourQuantities;
      }

      if (Array.isArray(activeProdConfig?.size_config?.dimensions) && activeProdConfig.size_config.dimensions.length > 0) {
        const sizeDims = activeProdConfig.size_config.dimensions.map((dim) => {
          const defaultPreset =
            dim.preset_sizes?.find((p) => p.is_usual)?.value ||
            dim.preset_sizes?.[0]?.value ||
            dim.default_value ||
            "";
          return {
            key: dim.key,
            label: dim.label,
            value: String(defaultPreset).replace(/in|mm|"|sq/g, "").trim(),
            unit: dim.unit || "in",
            isCustom: false,
          };
        });
        it.sizeDimensions = sizeDims;
        it.spec.sizeDimensions = sizeDims;
        delete it.dimensions;
        delete it.spec.dimensions;
        const comp = sizeDims.map((d) => d.value).filter(Boolean).join("×");
        if (comp && !it.size) {
          it.size = comp;
          it.spec.size = comp;
        }
      }

      if (activeProdConfig?.size_config?.default_indicative_rate) {
        const defRate = Number(activeProdConfig.size_config.default_indicative_rate) || 0;
        if (!it.sizeRate && defRate > 0) {
          it.sizeRate = defRate;
          it.spec.sizeRate = defRate;
        }
      }
      if (
        newType === "frame" ||
        newType === "lapel_pin" ||
        newType === "badge" ||
        newType === "cufflinks" ||
        newType === "tie_pin" ||
        newType === "fridge_magnet" ||
        newType === "flagstand" ||
        newType === "coaster" ||
        newType === "scroll" ||
        newType === "medal"
      ) {
        Object.assign(it.spec, grp.designSpec);
      }
      it.specLine = generateSpecLine(newType, it.spec, grp);
    });
  }
};

