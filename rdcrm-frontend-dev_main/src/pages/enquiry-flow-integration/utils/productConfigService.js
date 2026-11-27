import { useState, useEffect } from "react";
import { axiosInstance } from "../../../utils/url/config";

let cachedProducts = null;
let fetchPromise = null;

/**
 * Fetch all active product configurations strictly from Backend Master API (MongoDB).
 * Zero hardcoded fallback - returns empty array if API fails.
 */
export const fetchActiveProductConfigs = async () => {
  if (cachedProducts && cachedProducts.length > 0) {
    return cachedProducts;
  }

  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    try {
      const res = await axiosInstance.get("/enquiry-masters/product-config/active");
      if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
        cachedProducts = res.data.data;
        return cachedProducts;
      }
    } catch (err) {
      console.warn("Could not load dynamic product configs from API:", err?.message);
    } finally {
      fetchPromise = null;
    }

    // Zero fallback: return empty list
    return [];
  })();

  return fetchPromise;
};

/**
 * Invalidate in-memory cache (e.g. after updating a product in master)
 */
export const invalidateProductConfigCache = () => {
  cachedProducts = null;
  fetchPromise = null;
};

/**
 * React hook for consuming dynamic product configurations in Enquiry Flow
 */
export const useProductConfigs = () => {
  const [products, setProducts] = useState(cachedProducts || []);
  const [loading, setLoading] = useState(!cachedProducts);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const data = await fetchActiveProductConfigs();
      if (isMounted) {
        setProducts(data || []);
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const getProductConfig = (productId) => {
    if (!productId) return null;
    const cleanId = String(productId).toLowerCase().trim();
    return products.find((p) => p.product_id === cleanId) || null;
  };

  return {
    products,
    getProductConfig,
    loading,
    refreshConfigs: async () => {
      invalidateProductConfigCache();
      const fresh = await fetchActiveProductConfigs();
      if (fresh) setProducts(fresh);
    },
  };
};

export default {
  fetchActiveProductConfigs,
  invalidateProductConfigCache,
  useProductConfigs,
};
