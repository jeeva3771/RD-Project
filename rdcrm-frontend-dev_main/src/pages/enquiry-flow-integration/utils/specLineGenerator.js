// Utility to generate a human-readable 1-line product summary as defined in Ronald D'Souza Dev Spec v2 (Section 15)

export const generateSpecLine = (productType = "trophy", itemSpec = {}, group = {}) => {
  const spec = itemSpec || {};
  const pType = (productType || group.productType || group.type || "trophy").toLowerCase();

  switch (pType) {
    case "plaque": {
      const parts = ["Plaque"];
      if (spec.shape) parts.push(spec.shape);
      if (spec.material) parts.push(spec.material);
      if (spec.colour && spec.colour !== "+ Client colour") parts.push(spec.colour);
      else if (spec.color && spec.color !== "+ Client colour") parts.push(spec.color);
      if (spec.thk) parts.push(typeof spec.thk === "number" ? `${spec.thk} mm` : spec.thk);
      if (spec.print && spec.print.length > 0) {
        parts.push(Array.isArray(spec.print) ? spec.print.join(" + ") : spec.print);
      }
      const layerNum = spec.layers || 1;
      parts.push(`${layerNum} layer${layerNum > 1 ? "s" : ""}`);
      if (spec.edge) parts.push(spec.edge);
      if (spec.display) parts.push(spec.display);
      if (spec.acc && spec.acc.length > 0) {
        parts.push(Array.isArray(spec.acc) ? spec.acc.join(" + ") : spec.acc);
      }
      if (spec.names) parts.push(spec.names);
      if (spec.pack) parts.push(spec.pack);
      return parts.filter(Boolean).join(" · ");
    }

    case "medal": {
      const isZinc = spec.medalType === "zinc_cast" || spec.type === "zinc_cast" || group?.designSpec?.medalType === "zinc_cast";
      const front = spec.front_treatment || spec.zinc_front_treatment || spec.sideA || (isZinc ? "Custom die cast" : "Die punched");
      const hasFrontLabel = spec.front_has_label || spec.zinc_front_has_label;
      const frontLabelType = spec.front_label_type || spec.zinc_front_label_type;
      const frontLabelSize = spec.front_label_size || spec.zinc_front_label_size;
      const frontPasteSize = spec.front_paste_size || spec.zinc_front_paste_size;
      let frontStr = front;
      if (hasFrontLabel) {
        frontStr += ` (+${frontLabelType || "Label"}${frontLabelSize ? ` ${frontLabelSize}` : ""})`;
      } else if (frontPasteSize && (front === "Sticker" || front === "Shimmer pasting")) {
        frontStr += ` (${frontPasteSize})`;
      }

      const back = spec.back_treatment || spec.zinc_back_treatment || spec.sideB || "Blank";
      const hasBackLabel = spec.back_has_label || spec.zinc_back_has_label;
      const backLabelType = spec.back_label_type || spec.zinc_back_label_type;
      const backLabelSize = spec.back_label_size || spec.zinc_back_label_size;
      const backPasteSize = spec.back_paste_size || spec.zinc_back_paste_size;
      let backStr = back === "Blank" ? "Plain back" : back;
      if (back !== "Blank") {
        if (hasBackLabel) {
          backStr += ` (+${backLabelType || "Label"}${backLabelSize ? ` ${backLabelSize}` : ""})`;
        } else if (backPasteSize && (back === "Sticker" || back === "Shimmer pasting")) {
          backStr += ` (${backPasteSize})`;
        }
      }

      if (isZinc) {
        const shapeStr = spec.zinc_shape || spec.shape || "Round";
        const edgeStr = (spec.zinc_edge || spec.edge) ? ` · ${spec.zinc_edge || spec.edge} edge` : " · Plain edge";
        return `Medal · Zinc cast · Front: ${frontStr} · ${backStr} · ${shapeStr}${edgeStr}`;
      } else {
        return `Medal · MS punched · Round · Front: ${frontStr} · ${backStr}`;
      }
    }

    case "frame": {
      const sizeStr = spec.size || group?.items?.[0]?.size || "A4";
      const orientRaw = spec.orient || group?.designSpec?.orient || "portrait";
      const orientStr = orientRaw.charAt(0).toUpperCase() + orientRaw.slice(1).toLowerCase();
      const mWidth = spec.mWidth ?? group?.designSpec?.mWidth ?? 1;
      const glazingStr = spec.glazing || group?.designSpec?.glazing || "Acrylic 2 mm";
      const printStr = spec.print || group?.designSpec?.print || "RD arranges printing";
      const paperStr = spec.paper || group?.designSpec?.paper || "250 gsm art card";

      const A_SIZES = {
        A5: [5.8, 8.3],
        A4: [8.3, 11.7],
        A3: [11.7, 16.5],
        A2: [16.5, 23.4],
        "4×6": [4, 6],
        "5×7": [5, 7],
        "6×8": [6, 8],
        "8×10": [8, 10],
        "8×12": [8, 12],
        "10×12": [10, 12],
        "12×15": [12, 15],
        "12×18": [12, 18],
        "16×20": [16, 20]
      };
      let L = 8.3, B = 11.7;
      if (A_SIZES[sizeStr]) {
        [L, B] = A_SIZES[sizeStr];
      } else if (typeof sizeStr === "string" && sizeStr.includes("×")) {
        const parts = sizeStr.split("×");
        L = parseFloat(parts[0]) || 8;
        B = parseFloat(parts[1]) || 10;
      }
      const mount = spec.mount || group?.designSpec?.mount || "None";
      const mountBorder = mount && mount !== "None" ? 1.5 : 0;
      const outerL = Number((L + 2 * mountBorder + 2 * mWidth).toFixed(1));
      const outerB = Number((B + 2 * mountBorder + 2 * mWidth).toFixed(1));
      const rl = Math.round(2 * (outerL + outerB));
      const ft = (rl / 12).toFixed(1);

      return `Frame · ${sizeStr} · Certificate frame · ${orientStr} · ${mWidth} in moulding · ${glazingStr} · ${printStr} · ${paperStr} · Running length ${rl} in (${ft} ft)`;
    }

    case "lapel_pin": {
      const sizeStr = spec.size || group?.items?.[0]?.size || '1.5"';
      const processStr = spec.process || group?.designSpec?.process || "Photo laminated";
      const shapeStr = spec.shape || group?.designSpec?.shape || "Round";
      const metalStr = spec.metal || group?.designSpec?.metal || "Brass";
      const backStr = spec.back || group?.designSpec?.back || "Butterfly clutch";
      const numVal = parseFloat(sizeStr) || 1.5;
      const postsStr = spec.posts ? `${spec.posts} posts` : (numVal >= 1.5 ? "2 posts" : "1 post");
      return `Lapel pin · ${sizeStr} · ${processStr} · ${shapeStr} · ${metalStr} · ${backStr} · ${postsStr}`;
    }

    case "badge": {
      const bType = spec.badgeType || group?.designSpec?.badgeType || "name";
      if (bType === "button") {
        const diaStr = spec.size || group?.items?.[0]?.size || "44 mm";
        const backStr = spec.back || group?.designSpec?.back || "Pin";
        const artStr = spec.artwork || spec.art || group?.designSpec?.artwork || "Same for all";
        return `Button badge · ${diaStr} · ${backStr} · ${artStr}`;
      } else if (bType === "emblem") {
        const procStr = spec.process || group?.designSpec?.process || "Photo laminated";
        const shapeStr = spec.shape || group?.designSpec?.shape || "Round";
        const metalStr = spec.metal || group?.designSpec?.metal || "Brass";
        return `Emblem badge · ${procStr} · ${shapeStr} · ${metalStr}`;
      } else {
        const sizeStr = spec.size || group?.items?.[0]?.size || '2"';
        const matStr = spec.material || group?.designSpec?.material || "White acrylic";
        const decoStr = spec.deco || group?.designSpec?.deco || "UV print";
        const fixStr = spec.fix || group?.designSpec?.fix || "Pin";
        const linesList = spec.lines || group?.designSpec?.lines || ["Name", "Designation", "Logo"];
        const linesStr = Array.isArray(linesList) ? linesList.join(" + ") : linesList;
        return `Name badge · ${sizeStr} · ${matStr} · ${decoStr} · ${fixStr} · ${linesStr}`;
      }
    }

    case "cufflinks": {
      const sizeStr = spec.size || group?.items?.[0]?.size || "18 mm";
      const buildStr = spec.build || group?.designSpec?.build || "Custom die (logo)";
      const shapeStr = spec.shape || group?.designSpec?.shape || "Round";
      const closureStr = spec.closure || group?.designSpec?.closure || "Bullet back";
      const metalStr = spec.metal || group?.designSpec?.metal || "Brass";
      const platingStr = spec.plating || group?.designSpec?.plating || "Gold";
      const decoStr = spec.deco || group?.designSpec?.deco || "Hard enamel";
      const coloursCount = spec.colours !== undefined ? spec.colours : (group?.designSpec?.colours !== undefined ? group?.designSpec?.colours : 3);
      const coloursStr = `${coloursCount} colours`;
      const boxStr = spec.box || group?.designSpec?.box;
      const baseLine = `Cufflinks (pair) · ${sizeStr} · ${buildStr} · ${shapeStr} · ${closureStr} · ${metalStr} · ${platingStr} · ${decoStr} · ${coloursStr}`;
      return boxStr ? `${baseLine} · ${boxStr}` : baseLine;
    }

    case "tie_pin": {
      const lenStr = spec.len || spec.size || group?.items?.[0]?.size || '2.25"';
      const widStr = spec.wid || group?.designSpec?.wid || "6 mm";
      const claspStr = spec.clasp || group?.designSpec?.clasp || "Alligator clip";
      const decoStr = spec.deco || group?.designSpec?.deco || "Engraving";
      const metalStr = spec.metal || group?.designSpec?.metal || "Brass";
      const platingStr = spec.plating || group?.designSpec?.plating || "Gold";
      const personalStr = spec.personal && spec.personal !== "Off" ? spec.personal : null;
      const boxStr = spec.box || spec.pack || group?.designSpec?.box || null;
      const parts = ["Tie bar", lenStr, widStr, claspStr, decoStr, metalStr, platingStr];
      if (personalStr) parts.push(personalStr);
      if (boxStr) parts.push(boxStr);
      return parts.join(" · ");
    }

    case "fridge_magnet": {
      const szStr = spec.size || group?.items?.[0]?.size || "3×3 in";
      const buildStr = spec.build || "Paper laminated on MDF";
      const parts = ["Fridge magnet", szStr, buildStr];
      if (spec.paperPrint) parts.push(spec.paperPrint);
      if (spec.lam) parts.push(spec.lam);
      if (spec.thk) parts.push(spec.thk);
      if (spec.material && buildStr !== "Paper laminated on MDF") parts.push(spec.material);
      if (spec.deco && buildStr !== "Paper laminated on MDF") parts.push(spec.deco);
      parts.push(spec.cut || "Laser cut to shape");
      if (spec.shape) parts.push(spec.shape);
      parts.push(spec.magnet || "Magnetic sheet");
      parts.push(spec.artwork || "Same on all");
      if (spec.pack) parts.push(spec.pack);
      return parts.join(" · ");
    }

    case "flagstand": {
      const sizeStr = spec.size || group?.items?.[0]?.size || "10\"";
      const parts = ["Flag stand", sizeStr];
      const stand = spec.standType || spec.ftype;
      if (stand) parts.push(stand);
      if (spec.baseMat) parts.push(`${spec.baseMat} base`);
      if (spec.baseShape) parts.push(spec.baseShape);
      if (spec.baseBranding) parts.push(spec.baseBranding);
      if (spec.pole) parts.push(`${spec.pole} pole`);
      if (spec.finial && spec.finial !== "None") parts.push(`${spec.finial} top`);
      const fabric = spec.flagFabric || spec.flagMat;
      if (fabric) parts.push(`${fabric} flag`);
      if (spec.flagPrint) parts.push(spec.flagPrint);
      if (spec.flagSize) parts.push(spec.flagSize);
      if (spec.flagEdge) parts.push(spec.flagEdge);
      if (spec.whichFlags) parts.push(spec.whichFlags);
      const pkg = spec.packaging || spec.pack;
      if (pkg) parts.push(pkg);
      return parts.join(" · ");
    }

    case "coaster": {
      const sizeStr = spec.size || group?.items?.[0]?.size || "4\"";
      const buildStr = spec.build || "Paper laminated on MDF";
      const shapeStr = spec.shape || "Round";
      const perSetStr = spec.perSet ? `set of ${spec.perSet}` : "set of 4";
      const artStr = spec.artwork || "Same on all";

      const parts = ["Coasters", sizeStr, buildStr];
      if (buildStr === "Paper laminated on MDF") {
        if (spec.paperPrint || spec.printM) parts.push(spec.paperPrint || spec.printM);
        if (spec.lam) parts.push(spec.lam);
        const mdfThk = spec.mdf_thickness || spec.thk || spec.thkL;
        if (mdfThk) parts.push(mdfThk.includes("MDF") ? mdfThk : `${mdfThk} MDF`);
        if (spec.cutting && spec.cutting !== "Laser cut to shape") parts.push(spec.cutting);
      } else {
        if (spec.material || spec.mat) parts.push(spec.material || spec.mat);
        if (spec.thk || spec.thkL) {
          const t = spec.thk || spec.thkL;
          parts.push(String(t).includes("mm") ? String(t) : `${t} mm`);
        }
        if (spec.deco) parts.push(Array.isArray(spec.deco) ? spec.deco.join(", ") : spec.deco);
      }
      parts.push(shapeStr);
      parts.push(perSetStr);
      parts.push(artStr);
      if (spec.backing && spec.backing !== "None") parts.push(spec.backing);
      if (spec.setBox && spec.setBox !== "None") parts.push(spec.setBox);
      if (spec.outerPack && spec.outerPack !== "None") parts.push(spec.outerPack);
      return parts.join(" · ");
    }

    case "scroll": {
      const rawSize = spec.size || group?.items?.[0]?.size || "A4";
      let sizeStr = "A4";
      if (typeof rawSize === "string") {
        sizeStr = rawSize;
        if (rawSize.includes("×") || rawSize.includes("x")) {
          sizeStr = rawSize.includes("in") || rawSize.includes("mm") ? rawSize : `${rawSize} in`;
        }
      } else if (typeof rawSize === "number") {
        sizeStr = `${rawSize}"`;
      } else if (typeof rawSize === "object" && rawSize !== null) {
        if (rawSize.label) sizeStr = String(rawSize.label);
        else if (rawSize.value) sizeStr = String(rawSize.value);
        else if (rawSize.d1 && rawSize.d2) sizeStr = `${rawSize.d1}×${rawSize.d2} ${rawSize.unit || "in"}`;
        else sizeStr = "A4";
      }

      const parts = ["Scroll", sizeStr];
      const stype = spec.scrollType || spec.stype;
      if (stype) parts.push(stype);
      const orient = spec.orientation || "Portrait";
      parts.push(orient);
      const content = spec.contentBy || spec.print;
      if (content) parts.push(content);
      if (spec.rods && spec.rods !== "None") parts.push(`${spec.rods} rods`);
      if (spec.tie && spec.tie !== "None") parts.push(`${spec.tie} tie`);
      if (spec.seal && spec.seal !== "None") parts.push(spec.seal);
      const personal = spec.personal || spec.names || "Different name on each";
      parts.push(personal);
      if (spec.casing && spec.casing !== "None") parts.push(spec.casing);
      const pkg = spec.packaging || spec.pack;
      if (pkg) parts.push(pkg);
      return parts.join(" · ");
    }

    case "trophy":
    default: {
      const isShadowBox = spec.construction === "Shadow box (3D object)" || group.construction === "Shadow box (3D object)";
      if (isShadowBox) {
        const depthStr = spec.shadowDepth || "3\"";
        const backStr = spec.shadowBack || "Black velvet";
        const glazeStr = spec.shadowGlazing || "Clear acrylic";
        const dispStr = spec.shadowDisplay || "Wall mount";
        const objStr = spec.shadowObject ? ` · Mount: ${spec.shadowObject}` : "";
        const packStr = spec.packaging || group.packaging || "Thermocol + black top-bottom box";
        const textBrief = spec.trophyText || group.themeDesc || group.brief || group.theme || "";
        const briefSnippet = textBrief ? ` · ${textBrief.slice(0, 80)}` : "";
        return `Trophy · Shadow box (${depthStr} deep) · ${backStr} back · ${glazeStr} · ${dispStr}${objStr} · ${packStr}${briefSnippet}`.trim();
      }

      const baseStr = spec.base || group.base || "Solid MDF base";
      const constrStr = (group.construction && group.construction !== "Standard Custom Trophy" && group.construction !== "Composite with a solid base") ? ` · ${group.construction}` : "";
      const size = spec.size || group.size || 8;
      const sH = spec.trophyH || (Array.isArray(spec.sizeDimensions) ? spec.sizeDimensions.find((d) => d.key === "height")?.value : null);
      const sW = spec.trophyW || (Array.isArray(spec.sizeDimensions) ? spec.sizeDimensions.find((d) => d.key === "width")?.value : null);
      const sD = spec.trophyD || (Array.isArray(spec.sizeDimensions) ? spec.sizeDimensions.find((d) => d.key === "depth")?.value : null);
      const dims = sH && sW ? `${sH}"H × ${sW}"W × ${sD || 3}"D` : `${size} in`;
      
      const elementsList = Array.isArray(spec.elements) && spec.elements.length > 0 
        ? spec.elements 
        : (Array.isArray(group.elements) && group.elements.length > 0 ? group.elements : []);
      const elStr = elementsList.length > 0 ? ` · ${elementsList.join(", ")}` : "";

      const decoList = Array.isArray(spec.decorations) && spec.decorations.length > 0
        ? spec.decorations
        : (Array.isArray(group.decorations) && group.decorations.length > 0 ? group.decorations : []);
      const decoStr = decoList.length > 0 ? ` · ${decoList.join(", ")}` : "";

      const acrylicThkStr = (spec.acrylicThk || group.acrylicThk) ? ` · ${spec.acrylicThk || group.acrylicThk} acrylic` : "";
      const metalFinStr = (spec.metalFinish || group.metalFinish) ? ` · ${spec.metalFinish || group.metalFinish} metal` : "";

      const packStr = spec.packaging || group.packaging || "Thermocol + black top-bottom box";
      const textBrief = spec.trophyText || group.themeDesc || group.brief || group.theme || "Custom Trophy";
      const briefSnippet = textBrief.length > 90 ? `${textBrief.slice(0, 87)}...` : textBrief;

      return `Trophy · ${baseStr}${constrStr} · ${dims}${acrylicThkStr}${metalFinStr}${elStr}${decoStr} · ${packStr} · ${briefSnippet}`.trim();
    }
  }
};

