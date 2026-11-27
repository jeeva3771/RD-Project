import fetch from "node-fetch";

export const getImageBase64FromUrl = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch image");

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const ext = url.split(".").pop().split("?")[0]; // jpg or png
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";

  return `data:${mimeType};base64,${base64}`;
};
