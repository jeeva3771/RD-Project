import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { computeGroupLetter } from "../../utils/helpers";
import { formatEnquiryNo, ENQUIRY_CONFIG } from "../../utils/constants";
import ReadyTrophyForm from "./ask-step/ReadyTrophyForm";
import CustomTrophyForm from "./ask-step/CustomTrophyForm";
import WholeEnquiryForm from "./ask-step/WholeEnquiryForm";
import SavedProductsSummary from "./ask-step/SavedProductsSummary";

const AskStep = ({ s, set, client = {}, next, syncJobToBackend }) => {
  const e = s?.e || {};
  const parentJobNo = s.seq ? formatEnquiryNo(s.seq) : ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO;

  // Dynamically derive past booked trophies from the selected client (loaded once by parent EnquiryFlow)
  const clientPastOrders = (() => {
    const rawList = [
      ...(client?.pastOrders || []),
      ...(client?.live || []),
    ];
    const seenNames = new Set();
    const unique = [];

    for (const j of rawList) {
      const name = (j.name || j.product || "").trim();
      if (!name) continue;
      const normKey = name.toLowerCase();
      if (!seenNames.has(normKey)) {
        seenNames.add(normKey);
        unique.push({
          name,
          month: j.month || j.date || j.lastDate || "Recent",
          size: j.size || 8,
          rate: j.rate || (j.value ? Math.round(j.value / (j.qty || 1)) : 850),
          icon: "🏆",
        });
      }
    }
    return unique;
  })();

  const [modeSelected, setModeSelected] = useState(Boolean(e.askModeSelected));
  const [want, setWant] = useState(e.want || null);
  const [dismissedAlert, setDismissedAlert] = useState(false);
  const [typeCatKey, setTypeCatKey] = useState("classic");
  const [typeQuery, setTypeQuery] = useState("");

  const openEnqNo =
    client?.openEnqNo || (client?.open > 0 ? "ENQ/26/0398" : null);
  const showDuplicateAlert =
    !dismissedAlert && Boolean(openEnqNo) && !client?.isNew;

  const [trophyGroups, setTrophyGroups] = useState(
    e.trophyGroups || [
      {
        theme: e.theme || "",
        kind: "custom",
        productType: e.productType || null,
        type: e.type || "",
        mat: e.mat || null,
        mats: e.mats || (e.mat ? (e.mat.startsWith("Fusion: ") ? e.mat.replace("Fusion: ", "").split(" + ") : [e.mat]) : []),
        items: [
          {
            size: e.size || 8,
            qty: s.qty || e.qty || 50,
            budget: e.budget || 850,
            designOptionsCount: 2,
          },
        ],
      },
    ]
  );

  const [activeGroupIndex, setActiveGroupIndex] = useState(0);

  // Enquiry Level States
  const [occCatKey, setOccCatKey] = useState("Corporate");
  const [occQuery, setOccQuery] = useState("");
  const [occasion, setOccasion] = useState(e.occasion || "Annual awards");
  const [customOccasion, setCustomOccasion] = useState("");
  const [showCustomOccInput, setShowCustomOccInput] = useState(false);

  const [eventTimeframe, setEventTimeframe] = useState(
    e.eventTimeframe || "2w"
  );
  const [eventExactDate, setEventExactDate] = useState(e.event_date || e.eventExactDate || e.eventDate || "");
  const [eventExactTime, setEventExactTime] = useState(e.eventExactTime || "");
  const [isNotFixed, setIsNotFixed] = useState(Boolean(e.isNotFixed));
  const [eventInDays, setEventInDays] = useState(e.eventIn || 14);

  const [scope, setScope] = useState(e.scope || "local");
  const [destinationCity, setDestinationCity] = useState(
    e.destinationCity || ""
  );
  const [destinationCountry, setDestinationCountry] = useState(
    e.destinationCountry || ""
  );

  const [neededByDate, setNeededByDate] = useState(e.delivery_date || e.needed_by_date || e.neededByDate || e.deliveryDate || "");
  const [neededByNotDecided, setNeededByNotDecided] = useState(
    Boolean(e.neededByNotDecided)
  );
  const [jobCompletionDate, setJobCompletionDate] = useState(
    e.job_completion_date || e.jobCompletionDate || ""
  );
  const [deliverToAddress, setDeliverToAddress] = useState(
    e.deliverToAddress || "choose"
  );
  const [customShipTos, setCustomShipTos] = useState(e.customShipTos || []);

  const [whatNextSelected, setWhatNextSelected] = useState(null);
  const [productSaved, setProductSaved] = useState(e.productSaved || false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  const formatMatString = (matsArr) => {
    const mats = Array.isArray(matsArr)
      ? matsArr
      : matsArr
        ? [matsArr]
        : ["MDF"];
    if (mats.length === 0) return "MDF";
    if (mats.length === 1) return mats[0];
    return `Fusion: ${mats.join(" + ")}`;
  };

  const syncState = (groups = trophyGroups, chosenWant = want, immediate = false) => {
    const firstGroup = groups[0] || {
      theme: "Custom Trophy",
      items: [{ size: 8, qty: 50 }],
    };
    const firstItem = firstGroup.items[0] || { size: 8, qty: 50 };

    const moreItems = [];
    groups.forEach((group, gIdx) => {
      const groupChar = computeGroupLetter(gIdx);
      group.items.forEach((item, iIdx) => {
        if (gIdx === 0 && iIdx === 0) return;
        const subJobNo = `${parentJobNo}-${groupChar}${iIdx + 1}`;
        const sjColours = (item.colourQuantities && item.colourQuantities.length > 0)
          ? item.colourQuantities
          : (item.spec?.colourQuantities || []);
        const sjCustoms = (item.customFinishes && item.customFinishes.length > 0)
          ? item.customFinishes
          : (item.spec?.customFinishes || []);
        const sjDims = (item.sizeDimensions && item.sizeDimensions.length > 0)
          ? item.sizeDimensions
          : (item.spec?.sizeDimensions || []);
        moreItems.push({
          id: `sub_${groupChar}_${iIdx + 1}`,
          subJobNo,
          groupChar,
          sizeIdx: iIdx + 1,
          theme: group.theme,
          type: group.type || "Trophy",
          productType: group.productType || "trophy",
          mat: formatMatString(group.mats || group.mat || "MDF"),
          kind: group.kind || "custom",
          size: item.size,
          qty: item.qty,
          budget: item.budget,
          designOptionsCount: item.designOptionsCount || 2,
          sizeRate: item.sizeRate !== undefined ? item.sizeRate : (item.spec?.sizeRate || 0),
          sizeDimensions: sjDims,
          colourQuantities: sjColours,
          colour: item.colour || item.spec?.colour || "",
          customFinishes: sjCustoms,
          spec: {
            ...(item.spec || {}),
            ...(sjColours.length > 0 ? { colourQuantities: sjColours } : {}),
            ...(item.colour ? { colour: item.colour } : {}),
            ...(sjCustoms.length > 0 ? { customFinishes: sjCustoms } : {}),
            ...(sjDims.length > 0 ? { sizeDimensions: sjDims } : {}),
            ...(item.sizeRate !== undefined ? { sizeRate: item.sizeRate } : {}),
          },
          specLine: item.specLine || "",
        });
      });
    });

    const firstColours = (firstItem.colourQuantities && firstItem.colourQuantities.length > 0)
      ? firstItem.colourQuantities
      : (firstItem.spec?.colourQuantities || []);
    const firstCustoms = (firstItem.customFinishes && firstItem.customFinishes.length > 0)
      ? firstItem.customFinishes
      : (firstItem.spec?.customFinishes || []);
    const firstDims = (firstItem.sizeDimensions && firstItem.sizeDimensions.length > 0)
      ? firstItem.sizeDimensions
      : (firstItem.spec?.sizeDimensions || []);
    const activeGroup = (activeGroupIndex !== null && groups[activeGroupIndex]) ? groups[activeGroupIndex] : firstGroup;
    const activeItem = (activeGroup && activeGroup.items && activeGroup.items[0]) ? activeGroup.items[0] : firstItem;
    const syncDesignOpt = Math.min(
      5,
      Math.max(
        1,
        Number(
          activeGroup.designOptions ||
          (activeItem.spec && activeItem.spec.designOptions) ||
          activeItem.designOptions ||
          activeItem.designOptionsCount ||
          firstGroup.designOptions ||
          (firstItem.spec && firstItem.spec.designOptions) ||
          firstItem.designOptions ||
          firstItem.designOptionsCount ||
          2
        )
      )
    );

    set({
      qty: firstItem.qty,
      e: {
        ...s.e,
        want: chosenWant,
        askModeSelected: true,
        subJobNo: `${parentJobNo}-A1`,
        theme: firstGroup.theme,
        type: firstGroup.type || "Trophy",
        productType: firstGroup.productType || "trophy",
        mat: formatMatString(firstGroup.mats || firstGroup.mat || "MDF"),
        size: firstItem.size,
        qty: firstItem.qty,
        budget: firstItem.budget,
        sizeRate: firstItem.sizeRate !== undefined ? firstItem.sizeRate : (firstItem.spec?.sizeRate || 0),
        sizeDimensions: firstDims,
        // Sync design options count from AskStep into s.e so BriefStep can pre-fill it
        spec: {
          ...(firstItem.spec || {}),
          ...(firstColours.length > 0 ? { colourQuantities: firstColours } : {}),
          ...(firstItem.colour ? { colour: firstItem.colour } : {}),
          ...(firstCustoms.length > 0 ? { customFinishes: firstCustoms } : {}),
          ...(firstDims.length > 0 ? { sizeDimensions: firstDims } : {}),
          ...(firstItem.sizeRate !== undefined ? { sizeRate: firstItem.sizeRate } : {}),
        },
        designOptions: syncDesignOpt,
        specLine: firstItem.specLine || "",
        colourQuantities: firstColours,
        colour: firstItem.colour || firstItem.spec?.colour || "",
        customFinishes: firstCustoms,
        more: moreItems,
        trophyGroups: groups,
        occasion,
        eventIn: eventInDays,
        eventTimeframe,
        event_date: eventExactDate,
        eventExactTime,
        isNotFixed,
        scope,
        destinationCity,
        destinationCountry,
        delivery_date: neededByDate,
        neededByNotDecided,
        job_completion_date: jobCompletionDate,
        deliverToAddress,
        customShipTos,
        productSaved,
      },
      syncNow: immediate,
    }, immediate);
  };

  // Keep trophyGroups in sync when e.trophyGroups updates from server / open job
  useEffect(() => {
    if (e.trophyGroups && Array.isArray(e.trophyGroups) && e.trophyGroups.length > 0) {
      setTrophyGroups(e.trophyGroups);
    }
  }, [e.trophyGroups]);

  // Guarantee that default size (8) and quantity (50) in trophyGroups are synced into s.e on initial mount
  useEffect(() => {
    if (!e.size || !e.qty || !e.trophyGroups) {
      syncState(trophyGroups, want);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMaterialInGroup = (gIdx, targetMat) => {
    const updated = [...trophyGroups];
    const group = updated[gIdx];
    let curMats =
      Array.isArray(group.mats) && group.mats.length > 0
        ? [...group.mats]
        : group.mat && group.mat.startsWith("Fusion: ")
          ? group.mat.replace("Fusion: ", "").split(" + ")
          : [group.mat || "MDF"];

    curMats = curMats.map((m) => (m === "Resin cast" ? "Resin" : m));
    const normTarget = targetMat === "Resin cast" ? "Resin" : targetMat;

    if (curMats.includes(normTarget)) {
      if (curMats.length > 1) {
        curMats = curMats.filter((m) => m !== normTarget);
      }
    } else {
      if (curMats.length < 3) {
        curMats.push(normTarget);
      }
    }

    group.mats = curMats;
    group.mat = formatMatString(curMats);
    setTrophyGroups(updated);
    syncState(updated);
  };

  const toggleElementInGroup = (gIdx, elementId) => {
    const updated = [...trophyGroups];
    const group = updated[gIdx];
    let curElements = Array.isArray(group.elements) ? [...group.elements] : [];

    if (curElements.includes(elementId)) {
      curElements = curElements.filter((el) => el !== elementId);
    } else {
      curElements.push(elementId);
    }

    group.elements = curElements;
    setTrophyGroups(updated);
    syncState(updated);
  };

  const handleBackFromForm = () => {
    if (!productSaved && !e?.askDone) {
      set({
        e: {
          ...s.e,
          askModeSelected: false,
        },
      });
    }
    setModeSelected(false);
  };

  const handleModeChoice = (chosenWant) => {
    setWant(chosenWant);
    setModeSelected(true);
    const updated = [...trophyGroups];
    if (chosenWant === "ready") {
      updated[0].kind = "ready";
      updated[0].type = "Ready Trophy";
      updated[0].mat = "Ready Stock";
      updated[0].theme = "";
      updated[0].readyCode = "";
    } else if (chosenWant === "custom") {
      updated[0].kind = "custom";
      updated[0].productType = null;
      updated[0].type = "";
      updated[0].mat = null;
      updated[0].mats = [];
      updated[0].theme = "";
    }
    setTrophyGroups(updated);
    setProductSaved(false);
    syncState(updated, chosenWant);
  };

  const addTrophyGroup = (kind = "custom") => {
    const actualKind = typeof kind === "string" ? kind : "custom";
    const nextGroupChar = computeGroupLetter(trophyGroups.length);
    const isReady = actualKind === "ready";
    const updated = [
      ...trophyGroups,
      {
        theme: isReady ? "" : "",
        kind: actualKind,
        productType: isReady ? "ready" : null,
        type: isReady ? "Ready Trophy" : "",
        mat: isReady ? "Ready Stock" : null,
        mats: [],
        readyCode: "",
        items: [
          {
            size: 10,
            qty: 50,
            budget: isReady ? 0 : 1000,
            designOptionsCount: 1,
          },
        ],
      },
    ];
    setTrophyGroups(updated);
    setActiveGroupIndex(updated.length - 1);
    syncState(updated);
  };

  const addSizeToGroup = (gIdx) => {
    const updated = [...trophyGroups];
    const items = updated[gIdx].items;
    const lastItem = items[items.length - 1] || {};
    const lastSize = lastItem.size || 8;
    const nextItem = {
      size: typeof lastSize === "number" ? lastSize + 2 : lastSize,
      qty: lastItem.qty || 50,
      budget: lastItem.budget !== undefined ? lastItem.budget : 0,
      designOptionsCount: lastItem.designOptionsCount || 2,
    };
    if (lastItem.sizeDimensions && Array.isArray(lastItem.sizeDimensions)) {
      nextItem.sizeDimensions = JSON.parse(JSON.stringify(lastItem.sizeDimensions));
    }
    if (lastItem.spec) {
      nextItem.spec = {
        ...lastItem.spec,
        ...(lastItem.spec.sizeDimensions ? { sizeDimensions: JSON.parse(JSON.stringify(lastItem.spec.sizeDimensions)) } : {}),
      };
    }
    items.push(nextItem);
    setTrophyGroups(updated);
    syncState(updated);
  };

  const removeSizeFromGroup = (gIdx, iIdx) => {
    const updated = [...trophyGroups];
    if (updated[gIdx].items.length > 1) {
      updated[gIdx].items.splice(iIdx, 1);
      setTrophyGroups(updated);
      syncState(updated);
    }
  };

  const handleDiscardGroup = (gIdx) => {
    if (trophyGroups.length === 1) {
      setTrophyGroups([
        {
          theme: e.theme || "Custom Trophy",
          kind: "custom",
          items: [
            {
              size: e.size || 8,
              qty: s.qty || e.qty || 50,
              budget: e.budget || 850,
              designOptionsCount: 2,
            },
          ],
        },
      ]);
      setActiveGroupIndex(0);
      setModeSelected(false);
      setWant(null);
    } else {
      const updated = trophyGroups.filter((_, idx) => idx !== gIdx);
      setTrophyGroups(updated);
      setActiveGroupIndex(null);
      syncState(updated);
    }
  };

  const handleSaveAll = async (overrideGroups = null) => {
    const groupsToSave = overrideGroups || trophyGroups;
    syncState(groupsToSave);
    setProductSaved(true);
    setWhatNextSelected(null);
    set({ askDone: true, productSaved: true, syncNow: true });

    if (syncJobToBackend) {
      setIsSavingProduct(true);
      try {
        const cleanItemSpec = (item, grp = {}) => {
          const clean = { ...(item.spec || {}) };
          if (clean.sizeDimensions && Array.isArray(clean.sizeDimensions) && clean.sizeDimensions.length > 0) {
            delete clean.dimensions;
          }

          const isTrophy = (grp.productType || grp.type || "").toLowerCase().includes("trophy") || (grp.productType || grp.type || "").toLowerCase().includes("memento");
          if (!isTrophy) {
            delete clean.trophyW;
            delete clean.trophyD;
            delete clean.trophyH;
          }

          const rawColours = Array.isArray(item.colourQuantities)
            ? item.colourQuantities
            : (Array.isArray(clean.colourQuantities) ? clean.colourQuantities : []);
          if (rawColours.length > 0) {
            clean.colourQuantities = rawColours;
          } else {
            delete clean.colourQuantities;
          }

          const rawColour = item.colour !== undefined
            ? item.colour
            : (clean.colour !== undefined ? clean.colour : "");
          if (rawColour && String(rawColour).trim()) {
            clean.colour = String(rawColour).trim();
          } else {
            delete clean.colour;
          }

          const rawCustoms = Array.isArray(item.customFinishes)
            ? item.customFinishes
            : (Array.isArray(clean.customFinishes) ? clean.customFinishes : []);
          const customs = Array.isArray(rawCustoms)
            ? rawCustoms.map((c) => {
              if (typeof c === "string") return { colour: c, colourCode: "#B08D57", isCustom: true };
              return {
                colour: c.colour || c.name || "",
                colourCode: c.colourCode || c.code || "#B08D57",
                isCustom: true
              };
            }).filter((c) => Boolean(c.colour))
            : [];
          if (customs.length > 0) {
            clean.customFinishes = customs;
          } else {
            delete clean.customFinishes;
          }

          const rawDims = (item.sizeDimensions && item.sizeDimensions.length > 0)
            ? item.sizeDimensions
            : (clean.sizeDimensions && clean.sizeDimensions.length > 0)
              ? clean.sizeDimensions
              : [];
          if (rawDims.length > 0) {
            clean.sizeDimensions = rawDims;
          } else {
            delete clean.sizeDimensions;
          }

          if (item.budget !== undefined && item.budget !== "") {
            clean.budget = Number(item.budget);
          }
          if (item.sizeRate !== undefined) {
            clean.sizeRate = item.sizeRate;
          }
          return clean;
        };

        const sanitizedGroups = groupsToSave.map((grp) => ({
          ...grp,
          items: (grp.items || []).map((it) => {
            const cleanSpec = cleanItemSpec(it, grp);
            return {
              ...it,
              colourQuantities: cleanSpec.colourQuantities || [],
              colour: cleanSpec.colour || "",
              customFinishes: cleanSpec.customFinishes || [],
              sizeDimensions: cleanSpec.sizeDimensions || [],
              sizeRate: cleanSpec.sizeRate !== undefined ? cleanSpec.sizeRate : (it.sizeRate || 0),
              spec: cleanSpec,
            };
          }),
        }));

        const firstGroup = sanitizedGroups[0] || {
          theme: "Custom Trophy",
          items: [{ size: 8, qty: 50 }],
        };
        const firstItem = firstGroup.items[0] || { size: 8, qty: 50 };

        const moreItems = [];
        sanitizedGroups.forEach((group, gIdx) => {
          const groupChar = computeGroupLetter(gIdx);
          group.items.forEach((item, iIdx) => {
            if (gIdx === 0 && iIdx === 0) return;
            const subJobNo = `${parentJobNo}-${groupChar}${iIdx + 1}`;
            const cSpec = cleanItemSpec(item, group);
            moreItems.push({
              id: `sub_${groupChar}_${iIdx + 1}`,
              subJobNo,
              groupChar,
              sizeIdx: iIdx + 1,
              theme: group.theme,
              type: group.type || "Trophy",
              productType: group.productType || "trophy",
              mat: formatMatString(group.mats || group.mat || "MDF"),
              kind: group.kind || "custom",
              size: item.size,
              qty: item.qty,
              budget: item.budget,
              designOptionsCount: item.designOptionsCount || 2,
              spec: cSpec,
              specLine: item.specLine || "",
              colourQuantities: cSpec.colourQuantities || [],
              colour: cSpec.colour || "",
              customFinishes: cSpec.customFinishes || [],
            });
          });
        });

        const fSpec = cleanItemSpec(firstItem, firstGroup);

        const updatedState = {
          ...s,
          qty: firstItem.qty,
          askDone: true,
          productSaved: true,
          syncNow: true,
          e: {
            ...(s.e || {}),
            subJobNo: `${parentJobNo}-A1`,
            theme: firstGroup.theme,
            type: firstGroup.type || "Trophy",
            productType: firstGroup.productType || "trophy",
            mat: formatMatString(firstGroup.mats || firstGroup.mat || "MDF"),
            size: firstItem.size,
            qty: firstItem.qty,
            budget: firstItem.budget,
            designOptions: Math.min(
              5,
              Math.max(
                1,
                Number(
                  (firstGroup.items && firstGroup.items[0] && ((firstGroup.items[0].spec && firstGroup.items[0].spec.designOptions) || firstGroup.items[0].designOptions || firstGroup.items[0].designOptionsCount)) ||
                  firstGroup.designOptions ||
                  s.e?.designOptions ||
                  2
                )
              )
            ),
            spec: fSpec,
            specLine: firstItem.specLine || "",
            colourQuantities: fSpec.colourQuantities || [],
            colour: fSpec.colour || "",
            customFinishes: fSpec.customFinishes || [],
            more: moreItems,
            trophyGroups: sanitizedGroups,
            productSaved: true,
          },
        };

        await syncJobToBackend(updatedState);
        toast.success("Product details saved successfully!");
      } catch (err) {
        console.error("Failed to save product to DB:", err);
        toast.error("Failed to save product to database.");
      } finally {
        setIsSavingProduct(false);
      }
    }
  };

  // 1. Initial 3 Big Choice Cards
  if (!modeSelected) {
    return (
      <div className="fade space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <button
            type="button"
            className="p-6 bg-white border-2 border-gray-100 hover:border-indigo-500 rounded-2xl shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between text-left space-y-4"
            onClick={() => handleModeChoice("custom")}
          >
            <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-2xl font-bold">
              ✏️
            </div>
            <div>
              <h3 className="font-extrabold text-gray-900 text-base mb-1">
                Custom designed trophy
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Made to their design; we create options, Costing prices it, and
                a sample can be made.
              </p>
            </div>
          </button>

          <button
            type="button"
            className="p-6 bg-white border-2 border-gray-100 hover:border-indigo-500 rounded-2xl shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between text-left space-y-4"
            onClick={() => handleModeChoice("ready")}
          >
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center text-2xl font-bold">
              🏆
            </div>
            <div>
              <h3 className="font-extrabold text-gray-900 text-base mb-1">
                Ready trophy
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                From our ready stock, priced from the price list. No design or
                sample needed.
              </p>
            </div>
          </button>

          <button
            type="button"
            className="p-6 bg-white border-2 border-gray-100 hover:border-indigo-500 rounded-2xl shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between text-left space-y-4"
            onClick={() => handleModeChoice("both")}
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl font-bold">
              🧩
            </div>
            <div>
              <h3 className="font-extrabold text-gray-900 text-base mb-1">
                Both
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                A mix of custom designs and ready trophies in one enquiry.
              </p>
            </div>
          </button>
        </div>

        <div className="pt-2">
          <button
            type="button"
            className="btn ghost text-xs text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-lg border border-gray-300 font-semibold"
            onClick={() => set({ step: 0 })}
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // 1.5 View when Products are Done / Saved
  if (productSaved) {
    return (
      <div className="fade space-y-5">
        <SavedProductsSummary
          trophyGroups={trophyGroups}
          setTrophyGroups={setTrophyGroups}
          syncState={syncState}
          setProductSaved={setProductSaved}
          addTrophyGroup={addTrophyGroup}
          whatNextSelected={whatNextSelected}
          setWhatNextSelected={setWhatNextSelected}
          parentJobNo={parentJobNo}
          setActiveGroupIndex={setActiveGroupIndex}
        />

        {/* Render Whole Enquiry Form when 'Continue with the rest of the enquiry' card is clicked */}
        {whatNextSelected === "continue" && (
          <WholeEnquiryForm
            client={client}
            occasion={occasion}
            setOccasion={setOccasion}
            occCatKey={occCatKey}
            setOccCatKey={setOccCatKey}
            occQuery={occQuery}
            setOccQuery={setOccQuery}
            customOccasion={customOccasion}
            setCustomOccasion={setCustomOccasion}
            showCustomOccInput={showCustomOccInput}
            setShowCustomOccInput={setShowCustomOccInput}
            eventExactDate={eventExactDate}
            setEventExactDate={setEventExactDate}
            eventExactTime={eventExactTime}
            setEventExactTime={setEventExactTime}
            isNotFixed={isNotFixed}
            setIsNotFixed={setIsNotFixed}
            scope={scope}
            setScope={setScope}
            destinationCity={destinationCity}
            setDestinationCity={setDestinationCity}
            destinationCountry={destinationCountry}
            setDestinationCountry={setDestinationCountry}
            neededByDate={neededByDate}
            setNeededByDate={setNeededByDate}
            neededByNotDecided={neededByNotDecided}
            setNeededByNotDecided={setNeededByNotDecided}
            jobCompletionDate={jobCompletionDate}
            setJobCompletionDate={setJobCompletionDate}
            deliverToAddress={deliverToAddress}
            setDeliverToAddress={setDeliverToAddress}
            customShipTos={customShipTos}
            setCustomShipTos={setCustomShipTos}
            setProductSaved={setProductSaved}
            handleSaveAll={handleSaveAll}
            next={next}
            goBackToClient={() => set({ step: 0 })}
          />
        )}

        {whatNextSelected !== "continue" && (
          <div className="pt-2">
            <button
              type="button"
              className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl border border-gray-300 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              onClick={() => set({ step: 0 })}
            >
              <span>←</span>
              <span>Back</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // 2. Detailed Form View for editing trophy groups
  return (
    <div className="fade space-y-4">
      {/* Duplicate Alert Banner */}
      {showDuplicateAlert && (
        <div className="nudge gold p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-2xl text-xs text-amber-900 flex items-center justify-between flex-wrap gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-xs shrink-0">
              ★
            </span>
            <div>
              <b>{openEnqNo} is already open:</b> Annual awards 2027, around 150
              trophies. Same requirement? Link it instead of creating a
              duplicate.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="px-3.5 py-1.5 bg-white hover:bg-amber-100 text-amber-900 font-bold border border-amber-300 rounded-lg text-xs transition shadow-xs cursor-pointer"
              onClick={() => setDismissedAlert(true)}
            >
              Link
            </button>
            <button
              type="button"
              className="px-3.5 py-1.5 bg-amber-200/70 hover:bg-amber-200 text-amber-900 font-bold rounded-lg text-xs transition cursor-pointer"
              onClick={() => setDismissedAlert(true)}
            >
              It’s a new one
            </button>
          </div>
        </div>
      )}

      {/* Top Summary Card */}
      <div className="panel p-4 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-gray-900 uppercase tracking-wider">
            Products in this enquiry
          </div>
          <div className="flex items-center gap-3">
            <div className="text-[11px] text-gray-400 font-semibold">
              {trophyGroups.length} product{trophyGroups.length > 1 ? "s" : ""}{" "}
              · {trophyGroups.reduce((acc, g) => acc + g.items.length, 0)} size
              line
              {trophyGroups.reduce((acc, g) => acc + g.items.length, 0) > 1
                ? "s"
                : ""}
            </div>
            <button
              type="button"
              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs border border-indigo-200 transition cursor-pointer flex items-center gap-1 shadow-xs"
              onClick={() => addTrophyGroup("custom")}
            >
              <span>+ Add product</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {trophyGroups.map((group, gIdx) => {
            const isEditingThis = activeGroupIndex === gIdx;
            const items = group.items || [];
            const sizePillText = items
              .map(
                (it) =>
                  `${it.size || 8} in · ${it.qty || 50} pcs${it.budget ? ` · ₹${it.budget}` : ""}`
              )
              .join(" | ");

            return (
              <div
                key={gIdx}
                className={`p-3.5 border rounded-2xl flex items-center justify-between transition ${isEditingThis
                  ? "bg-indigo-50/50 border-indigo-200"
                  : "bg-gray-50/80 border-gray-200"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded-xl font-extrabold text-xs flex items-center justify-center ${isEditingThis
                      ? "bg-indigo-600 text-white"
                      : "bg-emerald-600 text-white"
                      }`}
                  >
                    {gIdx + 1}
                  </span>
                  <div>
                    <div className="font-bold text-sm text-gray-900">
                      {group.theme || `New custom design`}
                    </div>
                    <div className="text-[11px] text-gray-500 font-medium flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-extrabold text-[10px] uppercase">
                        {typeof group.kind === "string"
                          ? group.kind.toUpperCase()
                          : "CUSTOM"}
                      </span>
                      {group.readyCode && (
                        <span className="text-gray-400 font-semibold">
                          {group.readyCode}
                        </span>
                      )}
                      <span>
                        {group.type || "Product not chosen"}
                        {group.mat || (group.mats && group.mats.length > 0)
                          ? ` · ${formatMatString(group.mats || group.mat)}`
                          : ""}
                      </span>
                    </div>
                    {sizePillText && (
                      <div className="text-xs text-gray-500 font-medium mt-1">
                        <span className="px-2 py-0.5 rounded-full bg-gray-200/70 text-gray-700 text-[11px]">
                          {sizePillText}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isEditingThis ? (
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-800 font-extrabold text-xs rounded-lg">
                      Editing
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="px-3 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-gray-300 rounded-lg transition cursor-pointer"
                        onClick={() => setActiveGroupIndex(gIdx)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1 text-xs font-medium text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        onClick={() => handleDiscardGroup(gIdx)}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Group Form (Ready Trophy vs Custom Trophy) */}
      <div className="space-y-4">
        {trophyGroups.map((group, gIdx) => {
          const groupChar = computeGroupLetter(gIdx);
          const isActive = activeGroupIndex === gIdx;
          if (!isActive) return null;

          if (group.kind === "ready") {
            return (
              <ReadyTrophyForm
                key={gIdx}
                gIdx={gIdx}
                group={group}
                trophyGroups={trophyGroups}
                setTrophyGroups={setTrophyGroups}
                syncState={syncState}
                handleSaveAll={handleSaveAll}
                isSavingProduct={isSavingProduct}
                setActiveGroupIndex={setActiveGroupIndex}
                addSizeToGroup={addSizeToGroup}
                removeSizeFromGroup={removeSizeFromGroup}
                handleDiscardGroup={handleDiscardGroup}
              />
            );
          }

          return (
            <CustomTrophyForm
              key={gIdx}
              gIdx={gIdx}
              group={group}
              groupChar={groupChar}
              trophyGroups={trophyGroups}
              setTrophyGroups={setTrophyGroups}
              syncState={syncState}
              handleSaveAll={handleSaveAll}
              isSavingProduct={isSavingProduct}
              setActiveGroupIndex={setActiveGroupIndex}
              addSizeToGroup={addSizeToGroup}
              removeSizeFromGroup={removeSizeFromGroup}
              clientPastOrders={clientPastOrders}
              typeCatKey={typeCatKey}
              setTypeCatKey={setTypeCatKey}
              typeQuery={typeQuery}
              setTypeQuery={setTypeQuery}
              toggleMaterialInGroup={toggleMaterialInGroup}
              toggleElementInGroup={toggleElementInGroup}
              formatMatString={formatMatString}
              handleDiscardGroup={handleDiscardGroup}
            />
          );
        })}

        {/* Add Product & Navigation Footer */}
        <div className="pt-2 space-y-3">
          <button
            type="button"
            className="w-full py-4 border-2 border-dashed border-indigo-300 hover:border-indigo-500 rounded-2xl text-indigo-700 font-extrabold text-xs transition hover:bg-indigo-50/50 bg-white flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            onClick={() => addTrophyGroup("custom")}
          >
            <span className="text-base">➕</span>
            <span>Add another product / trophy design</span>
          </button>

          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <button
              type="button"
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl border border-gray-300 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              onClick={() => set({ step: 0 })}
            >
              <span>←</span>
              <span>Back</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AskStep;
