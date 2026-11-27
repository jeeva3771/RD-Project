import React from "react";
import ProductDesignCard from "./ProductDesignCard";

/**
 * ProductDesignSpecs Component
 * Delegates directly to the universal ProductDesignCard engine.
 */
const ProductDesignSpecs = (props) => {
  return <ProductDesignCard {...props} />;
};

export default ProductDesignSpecs;
export { ProductDesignCard };
