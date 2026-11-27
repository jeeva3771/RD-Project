import fetch from "node-fetch";

/**
 * Sends a 2Factor WhatsApp Template message.
 * Connects with 2Factor.in WhatsApp Gateway.
 * 
 * @param {string} phoneNumber - Recipient phone number (10 or 12 digits)
 * @param {object} values - Dynamic template positional parameters { "1": ..., "2": ... }
 * @param {string} [customUrl] - Optional URL override for dedicated templates
 * @returns {Promise<{success: boolean, message: string, data?: any, error?: any}>}
 */
export const sendTwoFactorWhatsAppTemplate = async (phoneNumber, values = {}, customUrl = null) => {
  try {
    if (!phoneNumber) {
      return { success: false, message: "Phone number is required for 2Factor WhatsApp" };
    }

    let formattedPhone = String(phoneNumber).replace(/\D/g, "");
    if (formattedPhone.length === 10) {
      formattedPhone = `91${formattedPhone}`;
    }

    const url = customUrl || process.env.TWOFACTOR_WHATSAPP_PRODUCT_CONFIRAMTION_URL;
    const apiKey = process.env.TWOFACTOR_WHATSAPP_API_KEY;

    if (!url || !apiKey) {
      console.warn("[2Factor WhatsApp] Missing configuration (TWOFACTOR_WHATSAPP_PRODUCT_CONFIRAMTION_URL or TWOFACTOR_WHATSAPP_API_KEY)");
      return { success: false, message: "2Factor WhatsApp configuration missing on server" };
    }

    const payload = {
      receiver: formattedPhone,
      values: values,
    };

    console.log(`[2Factor WhatsApp] Sending template to ${formattedPhone}...`, { url, values });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      const text = await response.text();
      data = { message: text };
    }

    if (response.ok) {
      console.log("[2Factor WhatsApp] Successfully sent template message:", data);
      return {
        success: true,
        message: "Message accepted by WhatsApp (2Factor)",
        data,
      };
    } else {
      console.error("[2Factor WhatsApp] API returned non-OK status:", response.status, data);
      return {
        success: false,
        message: data?.message || "Failed to send WhatsApp message via 2Factor",
        status: response.status,
        error: data,
      };
    }
  } catch (err) {
    console.error("[2Factor WhatsApp] Exception occurred:", err);
    return {
      success: false,
      message: err.message || "Network exception sending 2Factor WhatsApp",
      error: err,
    };
  }
};

export default {
  sendTwoFactorWhatsAppTemplate,
};
