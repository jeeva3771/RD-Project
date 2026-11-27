import DynamicProductSizeCard from "./DynamicProductSizeCard";
import CommonPriceSection from "./CommonPriceSection";

// Dynamic Proxy: Any productType access returns DynamicProductSizeCard
export const SIZE_CARD_MAP = new Proxy(
  {},
  {
    get: () => DynamicProductSizeCard,
  }
);

export { DynamicProductSizeCard, CommonPriceSection };
export default DynamicProductSizeCard;
