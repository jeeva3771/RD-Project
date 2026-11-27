import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { axiosInstance } from "../../../../utils/url/config";
import { formatEnquiryNo } from "../../utils/constants";
import {
  OneBriefForm,
  PerProductBriefForm,
  DesignSettingsCard,
  COPYRIGHT_OPTIONS,
} from "./brief-step";
import { checkMandatoryAssetsReadiness } from "../../utils/assetValidationHelpers";
import AssetRequirementGateModal from "../common/AssetRequirementGateModal";
import AssetUploadModal from "../common/AssetUploadModal";

/**
 * BriefStep Component
 * Refactored modular coordinator for the Brief stage of the Enquiry Flow.
 * Handles mode selection ("One brief for all" vs "Brief for each product"),
 * state synchronization, validation, designer assignment, and persistent storage.
 */
const BriefStep = ({ s, set, next }) => {
  const e = s?.e || {};

  // Derive client and enquiry metadata for R2 file naming / folders
  const clientId = s?.clientId || s?.customer_id?._id || s?.customer_id || "";
  const clientName = s?.client || s?.customer_id?.name || "";
  const enquiryNo = s?.enquiry_no || (s?.seq ? formatEnquiryNo(s.seq) : "");

  // Derive all products from trophyGroups
  const trophyGroups = e.trophyGroups || [];
  const products =
    trophyGroups.length > 0
      ? trophyGroups.map((g, i) => ({
          name: g.theme || `Product ${i + 1}`,
          kind: g.kind || "custom",
          items: g.items || [],
          designOptions: Math.min(
            5,
            Math.max(
              1,
              Number(
                g.designOptions ||
                  g.items?.[0]?.spec?.designOptions ||
                  g.items?.[0]?.designOptions ||
                  g.items?.[0]?.designOptionsCount ||
                  e.designOptions ||
                  2,
              ),
            ),
          ),
        }))
      : [
          {
            name: e.theme || "Custom Trophy",
            kind: e.askMode || "custom",
            items: [{ size: e.size || 8, qty: e.qty || 50 }],
            designOptions: Math.min(
              5,
              Math.max(1, Number(e.designOptions) || 2),
            ),
          },
        ];

  const isSingle = products.length === 1 && products[0].items.length === 1;
  const isAllReady =
    products.length > 0 && products.every((p) => p.kind === "ready");

  // Clear any legacy unkeyed brief draft from sessionStorage
  useEffect(() => {
    try {
      sessionStorage.removeItem("integration_brief_draft");
    } catch (_err) {
      /* ignore */
    }
  }, []);

  // Local state initialized STRICTLY from current enquiry props (never leaks across enquiries)
  const [briefMode, setBriefMode] = useState(
    e.briefMode || (products.length > 1 ? "each" : "one"),
  ); // "one" | "each"
  const [globalBrief, setGlobalBrief] = useState(
    e.globalBrief || s?.the_brief?.brief_text || "",
  );
  const [globalRefs, setGlobalRefs] = useState(
    e.globalRefs && e.globalRefs.length > 0
      ? e.globalRefs
      : s?.the_brief?.ref_files || [],
  );
  const [globalLogos, setGlobalLogos] = useState(
    e.globalLogos && e.globalLogos.length > 0
      ? e.globalLogos
      : e.clientLogo && e.clientLogo.length > 0
        ? e.clientLogo
        : s?.the_brief?.client_logo || [],
  );
  const [globalSignatures, setGlobalSignatures] = useState(
    e.globalSignatures && e.globalSignatures.length > 0
      ? e.globalSignatures
      : e.signatures && e.signatures.length > 0
        ? e.signatures
        : s?.the_brief?.signatures || [],
  );
  const [globalAdditionalFiles, setGlobalAdditionalFiles] = useState(
    e.globalAdditionalFiles && e.globalAdditionalFiles.length > 0
      ? e.globalAdditionalFiles
      : e.additionalFiles && e.additionalFiles.length > 0
        ? e.additionalFiles
        : s?.the_brief?.additional_files || [],
  );
  const [productBriefs, setProductBriefs] = useState(
    e.productBriefs || s?.the_brief?.product_briefs || {},
  );
  const [activeProductIdx, setActiveProductIdx] = useState(0);
  const [designer, setDesigner] = useState(
    isAllReady ? false : e.designer !== false,
  );
  const [assignedDesigner, setAssignedDesigner] = useState(
    isAllReady ? "" : e.assignedDesigner || e.designer_id || e.designerId || "",
  );
  const [assignedDesignerName, setAssignedDesignerName] = useState(
    isAllReady
      ? ""
      : e.assignedDesignerName || e.designer_name || e.designerName || "",
  );
  const [designersList, setDesignersList] = useState([]);
  const [quoteOnly, setQuoteOnly] = useState(e.quoteOnly || false);
  const [showRDLogo, setShowRDLogo] = useState(
    e.showRDLogo !== undefined ? e.showRDLogo : true,
  );
  const [showRDContent, setShowRDContent] = useState(e.showRDContent || false);
  const [copyrightContent, setCopyrightContent] = useState(
    e.copyrightContent ||
      e.copyright_content ||
      s?.the_brief?.copyright_content ||
      COPYRIGHT_OPTIONS[0].value,
  );
  const [designOptions, setDesignOptions] = useState(
    Math.min(
      5,
      Math.max(
        1,
        Number(
          e.designOptions ||
            (e.trophyGroups &&
              e.trophyGroups[0] &&
              (e.trophyGroups[0].designOptions ||
                e.trophyGroups[0].items?.[0]?.spec?.designOptions ||
                e.trophyGroups[0].items?.[0]?.designOptions ||
                e.trophyGroups[0].items?.[0]?.designOptionsCount)) ||
            2,
        ),
      ),
    ),
  );
  const [optionsDueIn, setOptionsDueIn] = useState(e.optionsDueIn || 24);
  const [linksDuration, setLinksDuration] = useState(e.links_duration || 24);

  const [isLogoMandatory, setIsLogoMandatory] = useState(
    Boolean(e.is_logo_mandatory ?? e.isLogoMandatory ?? s?.the_brief?.is_logo_mandatory ?? false)
  );
  const [isSignatureMandatory, setIsSignatureMandatory] = useState(
    Boolean(e.is_signature_mandatory ?? e.isSignatureMandatory ?? s?.the_brief?.is_signature_mandatory ?? false)
  );
  const [isAdditionalFilesMandatory, setIsAdditionalFilesMandatory] = useState(
    Boolean(e.is_additional_files_mandatory ?? e.isAdditionalFilesMandatory ?? s?.the_brief?.is_additional_files_mandatory ?? false)
  );

  // Missing mandatory assets gate & upload modal state
  const [showGateModal, setShowGateModal] = useState(false);
  const [gateMissingItems, setGateMissingItems] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedUploadProduct, setSelectedUploadProduct] = useState(null);

  useEffect(() => {
    if (isAllReady && designer) {
      setDesigner(false);
      setAssignedDesigner("");
      setAssignedDesignerName("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllReady]);

  useEffect(() => {
    axiosInstance
      .get("/enquiry-flow-integration/designers")
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.data)) {
          setDesignersList(res.data.data);
        }
      })
      .catch((err) => console.warn("Could not load designers from DB:", err));
  }, []);

  // Synchronize designOptions whenever AskStep passes a chosen design option count
  useEffect(() => {
    const rawVal =
      e.designOptions ||
      (e.trophyGroups &&
        e.trophyGroups[0] &&
        (e.trophyGroups[0].designOptions ||
          e.trophyGroups[0].items?.[0]?.spec?.designOptions ||
          e.trophyGroups[0].items?.[0]?.designOptions ||
          e.trophyGroups[0].items?.[0]?.designOptionsCount));
    const askVal = Math.min(5, Math.max(1, Number(rawVal) || 2));
    if (askVal && askVal !== designOptions) {
      setDesignOptions(askVal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.designOptions, e.trophyGroups]);

  const updateE = (patch) => set({ e: { ...e, ...patch } });

  const getCompiledBriefState = (patch = {}) => {
    const safePatch = (patch && typeof patch === "object" && !Array.isArray(patch)) ? patch : {};

    const effGlobalLogos =
      safePatch.globalLogos !== undefined
        ? safePatch.globalLogos
        : (safePatch.clientLogo !== undefined
          ? safePatch.clientLogo
          : (safePatch.clientLogos !== undefined
            ? safePatch.clientLogos
            : globalLogos));

    const effGlobalSignatures =
      safePatch.globalSignatures !== undefined
        ? safePatch.globalSignatures
        : (safePatch.signatures !== undefined
          ? safePatch.signatures
          : globalSignatures);

    const effGlobalFiles =
      safePatch.globalAdditionalFiles !== undefined
        ? safePatch.globalAdditionalFiles
        : (safePatch.additionalFiles !== undefined
          ? safePatch.additionalFiles
          : (safePatch.additional_files !== undefined
            ? safePatch.additional_files
            : globalAdditionalFiles));

    const effProductBriefs = safePatch.productBriefs !== undefined ? safePatch.productBriefs : productBriefs;

    return {
      ...e,
      briefMode: safePatch.briefMode || briefMode,
      globalBrief: safePatch.globalBrief !== undefined ? safePatch.globalBrief : globalBrief,
      globalRefs: safePatch.globalRefs !== undefined ? safePatch.globalRefs : globalRefs,
      globalLogos: effGlobalLogos,
      clientLogo: effGlobalLogos,
      clientLogos: effGlobalLogos,
      globalSignatures: effGlobalSignatures,
      signatures: effGlobalSignatures,
      globalAdditionalFiles: effGlobalFiles,
      additionalFiles: effGlobalFiles,
      additional_files: effGlobalFiles,
      is_logo_mandatory: safePatch.is_logo_mandatory !== undefined ? safePatch.is_logo_mandatory : isLogoMandatory,
      is_signature_mandatory: safePatch.is_signature_mandatory !== undefined ? safePatch.is_signature_mandatory : isSignatureMandatory,
      is_additional_files_mandatory: safePatch.is_additional_files_mandatory !== undefined ? safePatch.is_additional_files_mandatory : isAdditionalFilesMandatory,
      isLogoMandatory: safePatch.isLogoMandatory !== undefined ? safePatch.isLogoMandatory : isLogoMandatory,
      isSignatureMandatory: safePatch.isSignatureMandatory !== undefined ? safePatch.isSignatureMandatory : isSignatureMandatory,
      isAdditionalFilesMandatory: safePatch.isAdditionalFilesMandatory !== undefined ? safePatch.isAdditionalFilesMandatory : isAdditionalFilesMandatory,
      productBriefs: effProductBriefs,
      designer: safePatch.designer !== undefined ? safePatch.designer : designer,
      assignedDesigner: safePatch.assignedDesigner !== undefined ? safePatch.assignedDesigner : assignedDesigner,
      designerId: safePatch.assignedDesigner !== undefined ? safePatch.assignedDesigner : assignedDesigner,
      designer_id: safePatch.assignedDesigner !== undefined ? safePatch.assignedDesigner : assignedDesigner,
      assignedDesignerName: safePatch.assignedDesignerName !== undefined ? safePatch.assignedDesignerName : assignedDesignerName,
      designerName: safePatch.assignedDesignerName !== undefined ? safePatch.assignedDesignerName : assignedDesignerName,
      designer_name: safePatch.assignedDesignerName !== undefined ? safePatch.assignedDesignerName : assignedDesignerName,
      quoteOnly: safePatch.quoteOnly !== undefined ? safePatch.quoteOnly : quoteOnly,
      showRDLogo: safePatch.showRDLogo !== undefined ? safePatch.showRDLogo : showRDLogo,
      showRDContent: safePatch.showRDContent !== undefined ? safePatch.showRDContent : showRDContent,
      copyrightContent: safePatch.copyrightContent !== undefined ? safePatch.copyrightContent : copyrightContent,
      copyright_content: safePatch.copyrightContent !== undefined ? safePatch.copyrightContent : copyrightContent,
      designOptions: safePatch.designOptions !== undefined ? safePatch.designOptions : designOptions,
      optionsDueIn: safePatch.optionsDueIn !== undefined ? safePatch.optionsDueIn : optionsDueIn,
      links_duration: safePatch.links_duration !== undefined ? safePatch.links_duration : linksDuration,
      ...safePatch,
    };
  };

  // Immediate save to parent & backend DB (used upon image upload, blur, or confirm)
  const saveImmediately = (patch = {}) => {
    const updatedE = getCompiledBriefState(patch);
    set({ e: updatedE }, true);
  };

  const handleBackToProducts = () => {
    const updatedE = getCompiledBriefState();
    set({ e: updatedE, step: 1 }, true);
  };

  const handleGlobalRefsChange = (newRefs, immediate = false) => {
    setGlobalRefs(newRefs);
    if (immediate) {
      saveImmediately({ globalRefs: newRefs });
    }
  };

  const updateProductBrief = (productName, patch, immediate = false) => {
    const updated = {
      ...productBriefs,
      [productName]: { ...(productBriefs[productName] || {}), ...patch },
    };
    setProductBriefs(updated);
    if (immediate) {
      saveImmediately({ productBriefs: updated });
    }
  };

  const applyDesignerToAllProducts = (dId, dName) => {
    setAssignedDesigner(dId);
    setAssignedDesignerName(dName);
    const updated = { ...productBriefs };
    products.forEach((p) => {
      updated[p.name] = {
        ...(updated[p.name] || {}),
        assignedDesigner: dId,
        designerName: dName,
      };
    });
    setProductBriefs(updated);
    saveImmediately({
      assignedDesigner: dId,
      assignedDesignerName: dName,
      productBriefs: updated,
    });
  };

  const applyLogosToAllProducts = (newLogos) => {
    setGlobalLogos(newLogos);
    const updated = { ...productBriefs };
    products.forEach((p) => {
      updated[p.name] = {
        ...(updated[p.name] || {}),
        clientLogo: newLogos,
        client_logo: newLogos,
      };
    });
    setProductBriefs(updated);
    saveImmediately({
      globalLogos: newLogos,
      clientLogo: newLogos,
      clientLogos: newLogos,
      productBriefs: updated,
    });
    toast.success("Client logo applied to all products!");
  };

  const applySignaturesToAllProducts = (newSigs) => {
    setGlobalSignatures(newSigs);
    const updated = { ...productBriefs };
    products.forEach((p) => {
      updated[p.name] = {
        ...(updated[p.name] || {}),
        signatures: newSigs,
      };
    });
    setProductBriefs(updated);
    saveImmediately({
      globalSignatures: newSigs,
      signatures: newSigs,
      productBriefs: updated,
    });
    toast.success("Signatures applied to all products!");
  };

  const applyFilesToAllProducts = (newFiles) => {
    setGlobalAdditionalFiles(newFiles);
    const updated = { ...productBriefs };
    products.forEach((p) => {
      updated[p.name] = {
        ...(updated[p.name] || {}),
        additionalFiles: newFiles,
        additional_files: newFiles,
      };
    });
    setProductBriefs(updated);
    saveImmediately({
      globalAdditionalFiles: newFiles,
      additionalFiles: newFiles,
      additional_files: newFiles,
      productBriefs: updated,
    });
    toast.success("Additional files applied to all products!");
  };

  const applyRequirementsToAllProducts = (reqs) => {
    setIsLogoMandatory(reqs.isLogoMandatory);
    setIsSignatureMandatory(reqs.isSignatureMandatory);
    setIsAdditionalFilesMandatory(reqs.isAdditionalFilesMandatory);
    const updated = { ...productBriefs };
    products.forEach((p) => {
      updated[p.name] = {
        ...(updated[p.name] || {}),
        is_logo_mandatory: reqs.isLogoMandatory,
        is_signature_mandatory: reqs.isSignatureMandatory,
        is_additional_files_mandatory: reqs.isAdditionalFilesMandatory,
        isLogoMandatory: reqs.isLogoMandatory,
        isSignatureMandatory: reqs.isSignatureMandatory,
        isAdditionalFilesMandatory: reqs.isAdditionalFilesMandatory,
      };
    });
    setProductBriefs(updated);
    saveImmediately({
      is_logo_mandatory: reqs.isLogoMandatory,
      is_signature_mandatory: reqs.isSignatureMandatory,
      is_additional_files_mandatory: reqs.isAdditionalFilesMandatory,
      isLogoMandatory: reqs.isLogoMandatory,
      isSignatureMandatory: reqs.isSignatureMandatory,
      isAdditionalFilesMandatory: reqs.isAdditionalFilesMandatory,
      productBriefs: updated,
    });
    toast.success("Asset requirements applied to all products!");
  };

  // Synchronize state from parent if e or the_brief receives data (e.g. on load, refresh, or job open)
  useEffect(() => {
    const rawBrief = s?.the_brief || {};

    const bText = e.globalBrief || rawBrief.brief_text || "";
    const bRefs =
      e.globalRefs && e.globalRefs.length > 0
        ? e.globalRefs
        : rawBrief.ref_files && rawBrief.ref_files.length > 0
          ? rawBrief.ref_files
          : [];
    const pBriefs =
      e.productBriefs && Object.keys(e.productBriefs).length > 0
        ? e.productBriefs
        : rawBrief.product_briefs &&
            Object.keys(rawBrief.product_briefs).length > 0
          ? rawBrief.product_briefs
          : {};
    const bMode =
      e.briefMode ||
      (Object.keys(pBriefs).length > 0
        ? "each"
        : bText
          ? "one"
          : products.length > 1
            ? "each"
            : "one");
    const dId =
      e.assignedDesigner ||
      e.designer_id ||
      rawBrief.designer_id ||
      s?.assigned_designer ||
      "";
    const dName =
      e.assignedDesignerName ||
      e.designer_name ||
      rawBrief.designer_name ||
      s?.assigned_designer_name ||
      "";

    setGlobalBrief(bText);
    setGlobalRefs(bRefs);
    setProductBriefs(pBriefs);

    const bLogos =
      e.globalLogos && e.globalLogos.length > 0
        ? e.globalLogos
        : e.clientLogo && e.clientLogo.length > 0
          ? e.clientLogo
          : rawBrief.client_logo && rawBrief.client_logo.length > 0
            ? rawBrief.client_logo
            : [];
    const bSigs =
      e.globalSignatures && e.globalSignatures.length > 0
        ? e.globalSignatures
        : e.signatures && e.signatures.length > 0
          ? e.signatures
          : rawBrief.signatures && rawBrief.signatures.length > 0
            ? rawBrief.signatures
            : [];
    const bFiles =
      e.globalAdditionalFiles && e.globalAdditionalFiles.length > 0
        ? e.globalAdditionalFiles
        : e.additionalFiles && e.additionalFiles.length > 0
          ? e.additionalFiles
          : rawBrief.additional_files && rawBrief.additional_files.length > 0
            ? rawBrief.additional_files
            : [];

    setGlobalLogos(bLogos);
    setGlobalSignatures(bSigs);
    setGlobalAdditionalFiles(bFiles);

    if (bMode) setBriefMode(bMode);
    if (dId !== assignedDesigner) setAssignedDesigner(dId);
    if (dName !== assignedDesignerName) setAssignedDesignerName(dName);
    if (rawBrief.copyright_content)
      setCopyrightContent(rawBrief.copyright_content);
    if (rawBrief.show_logo !== undefined && e.showRDLogo === undefined)
      setShowRDLogo(Boolean(rawBrief.show_logo));
    if (rawBrief.show_content !== undefined && e.showRDContent === undefined)
      setShowRDContent(Boolean(rawBrief.show_content));
    if (e.is_logo_mandatory !== undefined || rawBrief.is_logo_mandatory !== undefined)
      setIsLogoMandatory(Boolean(e.is_logo_mandatory ?? rawBrief.is_logo_mandatory));
    if (e.is_signature_mandatory !== undefined || rawBrief.is_signature_mandatory !== undefined)
      setIsSignatureMandatory(Boolean(e.is_signature_mandatory ?? rawBrief.is_signature_mandatory));
    if (e.is_additional_files_mandatory !== undefined || rawBrief.is_additional_files_mandatory !== undefined)
      setIsAdditionalFilesMandatory(Boolean(e.is_additional_files_mandatory ?? rawBrief.is_additional_files_mandatory));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    s?.dbJobId,
    s?.seq,
    s?.the_brief,
    s?.the_brief?.client_logo,
    s?.the_brief?.signatures,
    s?.the_brief?.additional_files,
    e.globalBrief,
    e.globalRefs,
    e.globalLogos,
    e.clientLogo,
    e.globalSignatures,
    e.signatures,
    e.globalAdditionalFiles,
    e.additionalFiles,
    e.additional_files,
    e.productBriefs,
    e.briefMode,
    e.assignedDesigner,
    e.assignedDesignerName,
  ]);

  // Debounced auto-sync to parent e so typing or selecting options auto-syncs smoothly
  useEffect(() => {
    const timer = setTimeout(() => {
      const updatedE = {
        ...e,
        briefMode,
        globalBrief,
        globalRefs,
        globalLogos,
        clientLogo: globalLogos,
        clientLogos: globalLogos,
        globalSignatures,
        signatures: globalSignatures,
        globalAdditionalFiles,
        additionalFiles: globalAdditionalFiles,
        additional_files: globalAdditionalFiles,
        productBriefs,
        designer,
        assignedDesigner,
        designerId: assignedDesigner,
        designer_id: assignedDesigner,
        assignedDesignerName,
        designerName: assignedDesignerName,
        designer_name: assignedDesignerName,
        quoteOnly,
        showRDLogo,
        showRDContent,
        copyrightContent,
        copyright_content: copyrightContent,
        designOptions,
        optionsDueIn,
        links_duration: linksDuration,
      };
      set({ e: updatedE });
    }, 300);
    return () => {
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    briefMode,
    globalBrief,
    globalRefs,
    globalLogos,
    globalSignatures,
    globalAdditionalFiles,
    productBriefs,
    designer,
    assignedDesigner,
    assignedDesignerName,
    quoteOnly,
    showRDLogo,
    showRDContent,
    copyrightContent,
    designOptions,
    optionsDueIn,
    linksDuration,
  ]);

  const globalSettings = {
    designer,
    quoteOnly,
    showRDLogo,
    showRDContent,
    assignedDesigner,
    assignedDesignerName,
    copyrightContent,
    designOptions,
    optionsDueIn,
    linksDuration,
    is_logo_mandatory: isLogoMandatory,
    is_signature_mandatory: isSignatureMandatory,
    is_additional_files_mandatory: isAdditionalFilesMandatory,
    isLogoMandatory,
    isSignatureMandatory,
    isAdditionalFilesMandatory,
  };

  const handleGlobalUpdate = (patch) => {
    if ("designer" in patch) setDesigner(patch.designer);
    if ("quoteOnly" in patch) setQuoteOnly(patch.quoteOnly);
    if ("showRDLogo" in patch) setShowRDLogo(patch.showRDLogo);
    if ("showRDContent" in patch) {
      setShowRDContent(patch.showRDContent);
      if (patch.showRDContent && !copyrightContent && !patch.copyrightContent) {
        patch.copyrightContent = COPYRIGHT_OPTIONS[0].value;
        setCopyrightContent(COPYRIGHT_OPTIONS[0].value);
      }
    }
    if ("assignedDesigner" in patch)
      setAssignedDesigner(patch.assignedDesigner);
    if ("designerName" in patch) setAssignedDesignerName(patch.designerName);
    if ("copyrightContent" in patch)
      setCopyrightContent(patch.copyrightContent);
    if ("designOptions" in patch) setDesignOptions(patch.designOptions);
    if ("optionsDueIn" in patch) setOptionsDueIn(patch.optionsDueIn);
    if ("linksDuration" in patch || "links_duration" in patch) {
      const val = patch.linksDuration || patch.links_duration;
      setLinksDuration(val);
      saveImmediately({ links_duration: val });
    }

    // Sync showRDLogo, showRDContent, and copyrightContent to ALL product briefs immediately
    if (
      "showRDLogo" in patch ||
      "showRDContent" in patch ||
      "copyrightContent" in patch
    ) {
      const effCopyright =
        patch.copyrightContent ||
        copyrightContent ||
        (patch.showRDContent ? COPYRIGHT_OPTIONS[0].value : "");
      const updatedPBs = { ...productBriefs };
      products.forEach((p) => {
        updatedPBs[p.name] = {
          ...(updatedPBs[p.name] || {}),
          ...("showRDLogo" in patch ? { showRDLogo: patch.showRDLogo } : {}),
          ...("showRDContent" in patch
            ? { showRDContent: patch.showRDContent }
            : {}),
          copyrightContent: effCopyright,
        };
      });
      setProductBriefs(updatedPBs);
      saveImmediately({
        productBriefs: updatedPBs,
        ...patch,
        ...(patch.showRDContent && !patch.copyrightContent && !copyrightContent
          ? { copyrightContent: COPYRIGHT_OPTIONS[0].value }
          : {}),
      });
    }
  };

  const getProductBrief = (p) => {
    if (!p) return {};
    if (productBriefs[p.name]) return productBriefs[p.name];
    if (p.theme && productBriefs[p.theme]) return productBriefs[p.theme];
    const foundKey = Object.keys(productBriefs).find(
      (k) => k.toLowerCase() === (p.name || p.theme || "").toLowerCase(),
    );
    if (foundKey && productBriefs[foundKey]) return productBriefs[foundKey];
    return {};
  };

  let validationError = "";
  if (briefMode === "one") {
    const hasOneBrief = Boolean(globalBrief?.trim());
    if (!hasOneBrief) {
      validationError = "Please enter brief details to continue";
    } else if (designer && !assignedDesigner?.trim()) {
      validationError = "Please select a designer to continue";
    } else if (showRDContent && !copyrightContent) {
      validationError = "Please select copyright content";
    }
  } else if (briefMode === "each") {
    const missingBriefProducts = products.filter((p) => {
      const pb = getProductBrief(p);
      return !pb?.brief?.trim();
    });

    if (missingBriefProducts.length > 0) {
      if (missingBriefProducts.length === 1) {
        validationError = `Please enter brief for "${missingBriefProducts[0].name}" to continue`;
      } else {
        validationError = `Please enter brief for all products (${missingBriefProducts.length} missing) to continue`;
      }
    } else {
      const missingDesignerProducts = products.filter((p) => {
        if (p.kind === "ready") return false;
        const pb = getProductBrief(p);
        const needsDesigner =
          pb.designer !== undefined ? Boolean(pb.designer) : Boolean(designer);
        if (!needsDesigner) return false;
        const curAssigned = pb.assignedDesigner || assignedDesigner || "";
        return !curAssigned?.trim();
      });

      if (missingDesignerProducts.length > 0) {
        if (missingDesignerProducts.length === 1) {
          validationError = `Please select a designer for "${missingDesignerProducts[0].name}" to continue`;
        } else {
          validationError = `Please select a designer for all products (${missingDesignerProducts.length} missing) to continue`;
        }
      } else if (showRDContent && !copyrightContent) {
        validationError = "Please select copyright content";
      }
    }
  }

  const isValid = !validationError;

  const handleContinue = (forceProceed = false) => {
    if (!isValid) {
      toast.warn(
        validationError || "Please enter brief for all products to continue",
      );
      return;
    }
    const updatedE = getCompiledBriefState();

    // Check mandatory assets readiness if not force proceeding
    if (!forceProceed) {
      const readiness = checkMandatoryAssetsReadiness(products, updatedE, briefMode);
      if (readiness.hasMissing) {
        setGateMissingItems(readiness.missingList);
        setShowGateModal(true);
        return;
      }
    }

    // Atomically commit brief state and step transition to Step 3, immediately syncing step 3 to backend
    set({ e: updatedE, step: 3 }, true);
  };

  return (
    <div className="fade space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900 leading-tight">
          The Design Brief
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Tell the design team what the client wants. Reference images, text,
          anything specific.
        </p>
      </div>

      {/* Mode Selector */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-gray-700">
          How do you want to brief this?
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* One brief for all */}
          <button
            type="button"
            onClick={() => {
              setBriefMode("one");
              saveImmediately({ briefMode: "one" });
            }}
            className="p-4 rounded-2xl border-2 text-left transition cursor-pointer flex items-start gap-3"
            style={
              briefMode === "one"
                ? {
                    borderColor: "#635BFF",
                    backgroundColor: "#FAF9FF",
                  }
                : { borderColor: "#E5E7EB", backgroundColor: "#fff" }
            }
          >
            <span className="text-xl">📋</span>
            <div>
              <div className="font-extrabold text-xs text-gray-900">
                One brief for all products
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                All {products.length} products share the same theme, styling,
                and direction.
              </div>
            </div>
          </button>

          {/* Brief for each */}
          <button
            type="button"
            onClick={() => {
              setBriefMode("each");
              saveImmediately({ briefMode: "each" });
            }}
            className="p-4 rounded-2xl border-2 text-left transition cursor-pointer flex items-start gap-3"
            style={
              briefMode === "each"
                ? {
                    borderColor: "#635BFF",
                    backgroundColor: "#FAF9FF",
                  }
                : { borderColor: "#E5E7EB", backgroundColor: "#fff" }
            }
            disabled={products.length === 1 ? true : false}
          >
            <span className="text-xl">🗂️</span>
            <div>
              <div className="font-extrabold text-xs text-gray-900">
                A Brief for each product
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                Each product has a different concept, reference, or theme.
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* ── ONE BRIEF MODE ── */}
      {briefMode === "one" && (
        <>
          <OneBriefForm
            products={products}
            globalRefs={globalRefs}
            setGlobalRefs={handleGlobalRefsChange}
            globalBrief={globalBrief}
            setGlobalBrief={setGlobalBrief}
            globalLogos={globalLogos}
            setGlobalLogos={setGlobalLogos}
            globalSignatures={globalSignatures}
            setGlobalSignatures={setGlobalSignatures}
            globalAdditionalFiles={globalAdditionalFiles}
            setGlobalAdditionalFiles={setGlobalAdditionalFiles}
            isLogoMandatory={isLogoMandatory}
            setIsLogoMandatory={setIsLogoMandatory}
            isSignatureMandatory={isSignatureMandatory}
            setIsSignatureMandatory={setIsSignatureMandatory}
            isAdditionalFilesMandatory={isAdditionalFilesMandatory}
            setIsAdditionalFilesMandatory={setIsAdditionalFilesMandatory}
            clientId={clientId}
            clientName={clientName}
            enquiryNo={enquiryNo}
            onImmediateSave={saveImmediately}
          />

          <DesignSettingsCard
            isPerProduct={false}
            designer={designer}
            quoteOnly={quoteOnly}
            showRDLogo={showRDLogo}
            showRDContent={showRDContent}
            assignedDesigner={assignedDesigner}
            assignedDesignerName={assignedDesignerName}
            copyrightContent={copyrightContent}
            designOptions={designOptions}
            optionsDueIn={optionsDueIn}
            linksDuration={linksDuration}
            designersList={designersList}
            products={products}
            onUpdate={handleGlobalUpdate}
            onLinksDurationChange={(val) => {
              setLinksDuration(val);
              saveImmediately({ links_duration: val });
            }}
          />
        </>
      )}

      {/* ── EACH PRODUCT BRIEF MODE ── */}
      {briefMode === "each" && (
        <PerProductBriefForm
          products={products}
          activeProductIdx={activeProductIdx}
          setActiveProductIdx={setActiveProductIdx}
          productBriefs={productBriefs}
          updateProductBrief={updateProductBrief}
          applyDesignerToAllProducts={applyDesignerToAllProducts}
          applyLogosToAllProducts={applyLogosToAllProducts}
          applySignaturesToAllProducts={applySignaturesToAllProducts}
          applyFilesToAllProducts={applyFilesToAllProducts}
          applyRequirementsToAllProducts={applyRequirementsToAllProducts}
          designersList={designersList}
          globalDesignSettings={globalSettings}
          onGlobalUpdate={handleGlobalUpdate}
          clientId={clientId}
          clientName={clientName}
          enquiryNo={enquiryNo}
          onImmediateSave={saveImmediately}
          linksDuration={linksDuration}
          onLinksDurationChange={(val) => {
            setLinksDuration(val);
            saveImmediately({ links_duration: val });
          }}
        />
      )}

      {/* Bottom Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={handleBackToProducts}
          className="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
        >
          ← Back to Products
        </button>

        <div className="flex items-center gap-2">
          {!isValid && (
            <span className="text-[11px] text-amber-600 font-semibold">
              {validationError || "Fill the brief to continue"}
            </span>
          )}
          <button
            type="button"
            disabled={!isValid}
            onClick={handleContinue}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#635BFF" }}
          >
            <span>Continue to Commercials</span>
            <span>→</span>
          </button>
        </div>
      </div>
      {/* Missing Mandatory Assets Soft Gate Modal (Tier 1: Before Design Request) */}
      <AssetRequirementGateModal
        isOpen={showGateModal}
        onClose={() => setShowGateModal(false)}
        stage="design"
        missingItems={gateMissingItems}
        onUploadNow={(item) => {
          setSelectedUploadProduct(item.product);
          setShowUploadModal(true);
        }}
        onProceedAnyway={() => {
          setShowGateModal(false);
          handleContinue(true);
        }}
      />

      {/* Inline Quick Upload Modal */}
      {showUploadModal && (
        <AssetUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          product={selectedUploadProduct}
          clientId={clientId}
          clientName={clientName}
          enquiryNo={enquiryNo}
          onSaveAssets={({ subJobNo, client_logo, signatures, additional_files }) => {
            if (briefMode === "one") {
              setGlobalLogos(client_logo);
              setGlobalSignatures(signatures);
              setGlobalAdditionalFiles(additional_files);
              saveImmediately({
                globalLogos: client_logo,
                clientLogo: client_logo,
                clientLogos: client_logo,
                globalSignatures: signatures,
                signatures,
                globalAdditionalFiles: additional_files,
                additionalFiles: additional_files,
                additional_files,
              });
            } else {
              updateProductBrief(
                subJobNo,
                {
                  clientLogo: client_logo,
                  client_logo,
                  signatures,
                  additionalFiles: additional_files,
                  additional_files,
                },
                true
              );
            }
            setShowUploadModal(false);
            setTimeout(() => {
              const freshE = getCompiledBriefState();
              const freshReadiness = checkMandatoryAssetsReadiness(products, freshE, briefMode);
              if (!freshReadiness.hasMissing) {
                setShowGateModal(false);
              } else {
                setGateMissingItems(freshReadiness.missingList);
              }
            }, 100);
          }}
          onImmediateSave={saveImmediately}
        />
      )}
    </div>
  );
};

export default BriefStep;
