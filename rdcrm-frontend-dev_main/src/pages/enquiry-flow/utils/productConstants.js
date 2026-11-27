// Product Specification Selector Constants for RD Job Flow (Ronald D'Souza Dev Spec v2)

export const PRODUCT_TYPES = [];

// 1. Plaque Options
export const PLAQUE_SIZES = ["7×5", "8×6", "9×7", "8×10", "10×12", "12×14", "Custom"];
export const PLAQUE_SHAPES = ["Rectangle", "Rounded", "Shield", "Oval", "Round", "Custom cut"];
export const PLAQUE_MATERIALS = [
  "Clear acrylic",
  "Coloured acrylic",
  "Mirror acrylic",
  "MDF",
  "Wood",
  "Crystal / glass",
  "Glass",
  "Brass",
  "Aluminium",
  "Stainless steel",
  "3D-printed PLA",
  "Composite"
];
export const PLAQUE_THICKNESS = {
  acrylic: [2, 3, 4, 5, 6, 8, 10, 12, 15, 18],
  mdf_wood: [6, 12, 15, 18, 25],
  metal: [3, 6, 8],
  default: [3, 5, 6, 8, 12]
};
export const PLAQUE_PRINTS = [
  "UV print",
  "Laser engraving",
  "Laser cut",
  "Screen print",
  "Etching",
  "Sublimation",
  "Shimmer printing",
  "3D printing"
];
export const PLAQUE_ACCESSORIES = [
  "Keyhole",
  "Standoff studs",
  "Easel stand",
  "Metal name plate",
  "Metal logo",
  "Velvet box",
  "Wooden box",
  "Gift box"
];

// 2. Medal Options
export const MEDAL_MS_DIAMETERS = ["1.25\"", "1.5\"", "1.75\"", "2\"", "2.25\"", "2.5\""];
export const MEDAL_ZINC_DIAMETERS = [
  "1.25\"", "1.5\"", "1.75\"", "2\"", "2.25\"", "2.5\"", "2.75\"", "3\"", "3.25\"", "3.5\"", "3.75\"", "4\"", "5\"", "6\"", "Custom"
];
export const MEDAL_FINISHES = ["Gold", "Silver", "Bronze / copper", "Antique"];
export const MEDAL_ZINC_PLATINGS = [
  "Gold", "Silver", "Bronze", "Antique gold", "Antique silver", "Antique bronze", "Dual-tone"
];
export const MEDAL_RIBBON_WIDTHS = [12, 16, 20, 25, 30, 35];
export const MEDAL_HOOK_TYPES = ["Clamping", "J hook", "Fish hook"];
export const MEDAL_PASTE_SIZES = ["25 mm", "30 mm", "38 mm", "45 mm", "50 mm", "Custom"];
export const MEDAL_LABEL_TYPES = ["Sticker", "Shimmer pasting", "UV-printed label", "Epoxy dome sticker"];

// 3. Frame Options
export const FRAME_SIZES = [
  "A5", "A4", "A3", "A2", "4×6", "5×7", "6×8", "8×10", "8×12", "10×12", "12×15", "12×18", "16×20", "Custom"
];
export const FRAME_DEPTHS = ["2.5\"", "3\"", "4\""];
export const FRAME_MOUNTS = ["None", "Single", "Double", "Title window", "Logo cut"];
export const FRAME_MOUNT_BORDERS = [1, 1.5, 2, 3];
export const FRAME_GLAZINGS = ["Acrylic 2 mm", "Acrylic 3 mm", "Film"];
export const FRAME_STANDS = ["Plastic stand", "Metal stand", "Wall hook only"];
export const FRAME_MOULDING_VENDORS = ["Sun Frames", "Hatim Bhai"];

// 4. Lapel Pin & Shared Metal Options
export const PIN_SIZES = ["0.75\"", "1\"", "1.25\"", "1.5\"", "2\"", "Custom"];
export const METAL_PROCESSES = [
  "Photo laminated",
  "Etched + colour fill",
  "Etched + colour fill + photo laminated",
  "Soft enamel",
  "Die struck",
  "Zinc die-cast",
  "Hard enamel",
  "Epoxy"
];
export const METAL_PLATINGS = [
  "Gold", "Silver", "Chrome", "Copper", "Rose gold", "Black antique", "Rhodium", "Gunmetal"
];
export const METAL_SHAPES = ["Round", "Square", "Rectangle", "Oval", "Shield", "Logo cut-out"];
export const PIN_BACKINGS = [
  "Butterfly clutch", "Magnet", "Rubber clutch", "Locking clutch", "Safety pin"
];

// 5. Badge Options
export const BADGE_NAME_SIZES = ["44 mm", "56 mm", "2\"", "Custom"];
export const BADGE_BUTTON_SIZES = ["33 mm", "44 mm", "56 mm", "Custom"];
export const BADGE_MATERIALS = ["Mirror acrylic", "Acrylic", "Aluminium", "Brass", "Wood"];
export const BADGE_FIXINGS = ["Pin", "Magnetic", "Safety pin", "Clip"];

// 6. Cufflinks & Tie Pin Options
export const CUFFLINK_DECORATIONS = ["Hard enamel", "Soft enamel", "Engraving", "UV print + epoxy", "Gemstone"];
export const TIE_PIN_LENGTHS = ["1.5\"", "2\"", "2.25\"", "2.5\""];
export const TIE_PIN_WIDTHS = ["5 mm", "6 mm"];

// 7. Fridge Magnet Options
export const MAGNET_SIZES = ["2\"", "2.5\"", "3\"", "4\"", "Custom"];
export const MAGNET_TYPES = ["Magnetic sheet", "Ferrite button", "Neodymium"];

// 8. Flag Stand Options (v35)
export const FLAG_TYPES = ["Single flag", "Double (cross)", "Triple", "Multi (4+)"];
export const FLAG_BASE_MATERIALS = ["Acrylic", "MDF", "Wood", "Metal", "Marble finish"];
export const FLAG_BASE_SHAPES = ["Round", "Square", "Rectangle", "Logo cut"];
export const FLAG_POLES = ["Chrome metal", "Gold metal", "Black metal", "Wooden", "Acrylic"];
export const FLAG_FINIALS = ["Ball", "Spear", "Eagle", "None"];
export const FLAG_FABRICS = ["Satin", "Polyester", "Silk", "Knitted poly"];
export const FLAG_PRINTS = ["Sublimation (both sides)", "Sublimation (one side)", "Screen print"];
export const FLAG_SIZES = ["4×6 in", "5×8 in", "6×9 in", "8×12 in", "Other"];
export const FLAG_EDGES = ["Plain hem", "Gold fringe", "Silver fringe"];

// 9. Coaster Options (v35)
export const COASTER_SIZES = ["3.5\"", "4\"", "4×4 sq", "Custom"];
export const COASTER_SETS = [2, 4, 6, 8];
export const COASTER_MATERIALS = ["MDF", "Acrylic", "Wood", "Cork", "Leatherette", "Slate", "Metal"];
export const COASTER_BACKINGS = ["Cork base", "Felt base", "Anti-skid pads", "None"];
export const COASTER_BOXES = [
  "Printed box for the set",
  "Plain box for the set",
  "Acrylic holder",
  "Wooden holder",
  "MDF holder",
  "None"
];

// 10. Scroll Options (v35)
export const SCROLL_SIZES = ["A4", "A3", "10×14", "12×18", "Custom"];
export const SCROLL_TYPES = [
  "Parchment paper scroll",
  "Velvet / cloth scroll",
  "Wooden scroll",
  "Acrylic scroll",
  "Brass plate scroll"
];
export const SCROLL_RODS = ["Wooden", "Brass", "Gold-finish plastic", "Acrylic", "None"];
export const SCROLL_TIES = ["Ribbon", "Tassel", "Cord", "None"];
export const SCROLL_CASINGS = ["Velvet tube", "Scroll tube", "Scroll box", "Folder", "None"];
export const SCROLL_PRINTS = ["Digital print", "Screen print", "Laser engraving", "UV print", "Etching"];

// 11. Colour Swatch Map
export const SWATCH_MAP = {
  Gold: "#D4AF37",
  Silver: "#C0C0C0",
  Bronze: "#CD7F32",
  "Bronze / copper": "#B87333",
  Copper: "#B87333",
  Antique: "#7A5C2E",
  "Antique gold": "#9C7A2B",
  "Antique silver": "#8A8D91",
  "Antique bronze": "#6E4B2A",
  "Dual-tone": "linear-gradient(135deg,#D4AF37 50%,#C0C0C0 50%)",
  Chrome: "#DADDE2",
  "Rose gold": "#E0A899",
  "Black antique": "#3A3A3A",
  "Gold mirror": "linear-gradient(135deg,#F5D76E,#B8902C)",
  "Silver mirror": "linear-gradient(135deg,#F2F2F2,#9EA3A8)",
  "Rose gold mirror": "linear-gradient(135deg,#F3C3B5,#C48474)",
  White: "#FFFFFF",
  Black: "#111111",
  Wood: "#A0703C",
  Red: "#D7263D",
  Blue: "#2E5BBA",
  Yellow: "#F2C230",
  Green: "#2F9E44"
};

// 12. Shared Packaging Master Options
export const PACKAGING_OPTIONS = [
  "Thermocol + top-bottom box",
  "E-flute box",
  "Polybag",
  "Velvet pouch",
  "Velvet box",
  "Branded box (logo on lid)",
  "Printed backing card",
  "Corner guards"
];
