/**
 * assetValidationHelpers.js
 *
 * Helpers to evaluate mandatory asset requirements (Client Logo, Signatures, Additional Files)
 * across Brief, Design Options, and Production DTP stages.
 */

/**
 * Returns the asset mandatory requirements and upload status for a single product / sub-job.
 */
export const getProductAssetStatus = (product = {}, theBrief = {}, isPerProduct = false) => {
  const isLogoMandatory = Boolean(
    isPerProduct
      ? product.is_logo_mandatory
      : (theBrief.is_logo_mandatory ?? product.is_logo_mandatory)
  );

  const isSignatureMandatory = Boolean(
    isPerProduct
      ? product.is_signature_mandatory
      : (theBrief.is_signature_mandatory ?? product.is_signature_mandatory)
  );

  const isAdditionalFilesMandatory = Boolean(
    isPerProduct
      ? product.is_additional_files_mandatory
      : (theBrief.is_additional_files_mandatory ?? product.is_additional_files_mandatory)
  );

  const logos = Array.isArray(product.client_logo)
    ? product.client_logo
    : Array.isArray(theBrief.client_logo)
    ? theBrief.client_logo
    : [];

  const signatures = Array.isArray(product.signatures)
    ? product.signatures
    : Array.isArray(theBrief.signatures)
    ? theBrief.signatures
    : [];

  const additionalFiles = Array.isArray(product.additional_files)
    ? product.additional_files
    : Array.isArray(theBrief.additional_files)
    ? theBrief.additional_files
    : [];

  const hasLogo = logos.length > 0;
  const hasSignature = signatures.length > 0;
  const hasAdditionalFiles = additionalFiles.length > 0;

  const missingAssets = [];
  if (isLogoMandatory && !hasLogo) missingAssets.push("Client Logo");
  if (isSignatureMandatory && !hasSignature) missingAssets.push("Signature");
  if (isAdditionalFilesMandatory && !hasAdditionalFiles) missingAssets.push("Additional Files");

  return {
    isLogoMandatory,
    isSignatureMandatory,
    isAdditionalFilesMandatory,
    hasLogo,
    hasSignature,
    hasAdditionalFiles,
    logosCount: logos.length,
    signaturesCount: signatures.length,
    additionalFilesCount: additionalFiles.length,
    missingAssets,
    isMissingAny: missingAssets.length > 0,
  };
};

/**
 * Evaluates all active custom products in an enquiry to check if any mandatory assets are missing.
 *
 * @param {Array} products - List of products / sub-jobs
 * @param {Object} theBrief - Global the_brief object
 * @param {String} briefMode - "one" or "each"
 * @returns {Object} { hasMissing, missingList, summaryText }
 */
export const checkMandatoryAssetsReadiness = (products = [], theBrief = {}, briefMode = "one") => {
  const isPerProduct = briefMode === "each";
  const missingList = [];

  const activeProducts = products.filter(
    (p) => !p.is_dropped && !p.is_on_hold && p.trophy_type !== "ready" && p.kind !== "ready"
  );

  activeProducts.forEach((p) => {
    const status = getProductAssetStatus(p, theBrief, isPerProduct);
    if (status.isMissingAny) {
      missingList.push({
        productName: p.name || p.product_name || p.theme || "Product",
        subJobNo: p.subJobNo || p.sub_job_no || "",
        missingAssets: status.missingAssets,
        status,
        product: p,
      });
    }
  });

  let summaryText = "";
  if (missingList.length === 1) {
    const item = missingList[0];
    summaryText = `${item.missingAssets.join(" & ")} is marked as mandatory for "${item.productName}", but not yet uploaded.`;
  } else if (missingList.length > 1) {
    summaryText = `${missingList.length} products have missing mandatory assets (${missingList
      .map((m) => `${m.productName}: ${m.missingAssets.join(", ")}`)
      .join(" · ")}).`;
  }

  return {
    hasMissing: missingList.length > 0,
    missingCount: missingList.length,
    missingList,
    summaryText,
  };
};
