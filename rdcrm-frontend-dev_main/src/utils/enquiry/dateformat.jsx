export const formatDateToDDMMYYYY = (dateVal) => {
  if (!dateVal) return "";
  let dateStr = dateVal instanceof Date ? dateVal.toISOString().split("T")[0] : String(dateVal);
  if (!dateStr.includes("-")) return dateStr;
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${day}-${month}-${year}`;
  }
  return dateStr;
};

export const formatDateToYYYYMMDD = (dateVal) => {
  if (!dateVal) return "";
  let dateStr = dateVal instanceof Date ? dateVal.toISOString().split("T")[0] : String(dateVal);

  // Handle ISO strings or strings with time
  if (dateStr.includes("T")) {
    dateStr = dateStr.split("T")[0];
  }

  // handle DD-MM-YYYY input
  if (dateStr.includes("-")) {
    const parts = dateStr.split("-");
    if (parts.length === 3 && parts[0].length === 2) {
      const [day, month, year] = parts;
      return `${year}-${month}-${day}`; // converts to YYYY-MM-DD
    }
  }
  return dateStr;
};
