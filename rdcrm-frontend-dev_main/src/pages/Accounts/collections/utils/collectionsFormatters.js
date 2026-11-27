import { MONTH_NAMES } from "../constants/collectionsConstants";

export const inr = (n) => "₹ " + Number(n || 0).toLocaleString("en-IN");

export function formatDate(d) {
  if (!d) return "—";
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return "—";
  return `${dateObj.getDate()} ${MONTH_NAMES[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
}

export const isPromiseOverdue = (dateIso) => {
  if (!dateIso) return false;
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return false;
  d.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return d < now;
};

