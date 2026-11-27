import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import DynamicDesignForm from "./DynamicDesignForm";
import { fetchActiveProductConfigs } from "../../../../../reducer/masters/enquiryFlow/productConfigMasterReducer";

/**
 * Universal Dynamic Design Specs Component (Section 2: "What's the design?")
 * 100% Master-Data-Driven: Pulls all fields, options, and rules directly from Product Configuration Master (MongoDB).
 * Uses DynamicDesignForm as the single unified renderer for all standard products.
 */
const ProductDesignSpecs = ({
  group,
  gIdx,
  productType = "trophy",
  trophyGroups,
  setTrophyGroups,
  syncState,
}) => {
  const dispatch = useDispatch();

  const { activeItems = [] } = useSelector((state) => state.productConfigMaster || {});
  const productConfig = activeItems.find((p) => p.product_id === productType);

  useEffect(() => {
    if (!activeItems || activeItems.length === 0) {
      dispatch(fetchActiveProductConfigs());
    }
  }, [dispatch, activeItems]);

  // Trophy / Memento design questionnaire is handled in CustomTrophyForm
  if (productType === "trophy" || productType === "memento") {
    return null;
  }

  return (
    <DynamicDesignForm
      group={group}
      gIdx={gIdx}
      productType={productType}
      trophyGroups={trophyGroups}
      setTrophyGroups={setTrophyGroups}
      syncState={syncState}
      productConfig={productConfig}
    />
  );
};

export default ProductDesignSpecs;
