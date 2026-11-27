// Master cache service for enquiry flow
export const invalidateMasterCache = (endpoint) => {
  // Can be used to invalidate cached master data across enquiry flow components
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("enquiry-master-invalidated", { detail: { endpoint } }));
  }
};

export default {
  invalidateMasterCache,
};
