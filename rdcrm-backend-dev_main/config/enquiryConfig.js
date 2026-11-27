/**
 * Centralized Enquiry Number & Sequence Configuration (RD CRM)
 * =============================================================
 * SINGLE SOURCE OF TRUTH for enquiry number generation and sequencing.
 * Config-Driven Template: Any future format change can be made by editing
 * the ENQUIRY_CONFIG object below without touching controllers or components.
 */

export const ENQUIRY_CONFIG = {
  PREFIX: "RD",          // Company prefix: e.g. "RD", "ENQ"
  SEPARATOR: "",         // Delimiter: "" ("RD26001"), "/" ("RD/26/001"), "-" ("RD-26-001")
  INCLUDE_YEAR: true,    // Whether to embed year in sequence
  YEAR_FORMAT: "YY",     // "YY" (e.g. "26") or "YYYY" (e.g. "2026")
  PAD_LENGTH: 3,         // Minimum digits: 2 ("01"), 3 ("001"), 4 ("0001") (auto-expands for 1000+)
  STARTING_SEQ: 1,       // Starting sequence for fresh setup or new year
  RESET_YEARLY: true,    // true: sequence resets on year rollover; false: continuous sequence
  DEFAULT_ENQUIRY_NO: "RD26001",
};

/**
 * Returns current year code according to YEAR_FORMAT setting ("YY" or "YYYY").
 */
export const getCurrentYearCode = (cfg = ENQUIRY_CONFIG) => {
  const fullYear = String(new Date().getFullYear());
  return cfg.YEAR_FORMAT === "YYYY" ? fullYear : fullYear.slice(-2);
};

/**
 * Universal Parser: Parses any enquiry number format (e.g. "RD26001", "RD/26/001", "RD-2026-001")
 * into its constituent parts: { prefix, year, seq, raw }.
 */
export const parseEnquiryNo = (val, cfg = ENQUIRY_CONFIG) => {
  if (!val) return null;
  const str = String(val).trim();

  // 1. If explicit separator exists (e.g. "RD/26/001" or "RD-2026-001")
  const sepMatch = str.match(/^([A-Z]+)[/_-\s](\d{2,4})[/_-\s](\d+)$/i);
  if (sepMatch) {
    return {
      prefix: sepMatch[1].toUpperCase(),
      year: sepMatch[2],
      seq: parseInt(sepMatch[3], 10),
      raw: str,
    };
  }

  // 2. If no separator (e.g. "RD26001", "RD26100", "RD261000")
  const yearDigits = cfg.YEAR_FORMAT === "YYYY" ? 4 : 2;
  const noSepRegex = new RegExp(`^([A-Z]+)(\\d{${yearDigits}})(\\d+)$`, "i");
  const noSepMatch = str.match(noSepRegex);
  if (noSepMatch) {
    return {
      prefix: noSepMatch[1].toUpperCase(),
      year: noSepMatch[2],
      seq: parseInt(noSepMatch[3], 10),
      raw: str,
    };
  }

  // 3. Fallback without year (e.g. "RD1001", "RD50")
  const simpleMatch = str.match(/^([A-Z]+)(\d+)$/i);
  if (simpleMatch) {
    return {
      prefix: simpleMatch[1].toUpperCase(),
      year: null,
      seq: parseInt(simpleMatch[2], 10),
      raw: str,
    };
  }
  return null;
};

/**
 * Universal Formatter: Formats sequence number using the declarative template in ENQUIRY_CONFIG.
 * e.g. formatEnquiryNo(1) -> "RD26001"
 * e.g. formatEnquiryNo(100) -> "RD26100"
 * e.g. formatEnquiryNo(1000) -> "RD261000"
 */
export const formatEnquiryNo = (seq, yearVal, cfg = ENQUIRY_CONFIG) => {
  if (!seq && seq !== 0) {
    const yr = yearVal || getCurrentYearCode(cfg);
    const padded = String(cfg.STARTING_SEQ).padStart(cfg.PAD_LENGTH, "0");
    return cfg.INCLUDE_YEAR
      ? [cfg.PREFIX, yr, padded].filter(Boolean).join(cfg.SEPARATOR)
      : [cfg.PREFIX, padded].filter(Boolean).join(cfg.SEPARATOR);
  }

  const str = String(seq).trim();
  if (str.toUpperCase().startsWith(cfg.PREFIX)) {
    return str;
  }

  // Handle combined numeric e.g. 26001
  const parsed = parseEnquiryNo(str);
  const num = parsed?.seq || parseInt(str, 10);
  const rawSeq = !isNaN(num) && num > 0 ? num : cfg.STARTING_SEQ;
  const padded = String(rawSeq).padStart(cfg.PAD_LENGTH, "0");
  const yr = yearVal || parsed?.year || getCurrentYearCode(cfg);

  if (cfg.INCLUDE_YEAR) {
    return [cfg.PREFIX, yr, padded].filter(Boolean).join(cfg.SEPARATOR);
  }
  return [cfg.PREFIX, padded].filter(Boolean).join(cfg.SEPARATOR);
};

/**
 * Derives document numbers (Quotation, Costing, Sample, Proforma, Challan) from Enquiry Number.
 * e.g. deriveDocNo("RD26001", "QT") -> "QT26001"
 * e.g. deriveDocNo("RD26001", "RD/S") -> "RD/S/26001"
 */
export const deriveDocNo = (enquiryNo, docPrefix, cfg = ENQUIRY_CONFIG) => {
  const effEnq = enquiryNo || formatEnquiryNo(cfg.STARTING_SEQ);
  const parsed = parseEnquiryNo(effEnq);
  if (!parsed) return `${docPrefix}${effEnq}`;

  const yr = parsed.year || getCurrentYearCode(cfg);
  const padded = String(parsed.seq).padStart(cfg.PAD_LENGTH, "0");

  if (docPrefix === "PI") {
    return `PI/${yr}/${padded}`;
  }
  if (docPrefix === "DC") {
    return `DC/${yr}/${padded}`;
  }
  if (docPrefix.includes("/")) {
    return `${docPrefix}/${yr}${padded}`;
  }
  return `${docPrefix}${yr}${padded}`;
};

/**
 * Computes next sequential number based on last job in DB and year rollover setting.
 */
export const computeNextSeq = (lastJob, targetYear = getCurrentYearCode(), cfg = ENQUIRY_CONFIG) => {
  if (!lastJob) return cfg.STARTING_SEQ;

  const parsed = parseEnquiryNo(lastJob.enquiry_no);
  const jobYear = parsed?.year || lastJob.year;
  const jobSeq = parsed?.seq || lastJob.seq;

  if (cfg.RESET_YEARLY) {
    if (jobYear === targetYear && typeof jobSeq === "number") {
      return jobSeq + 1;
    }
    return cfg.STARTING_SEQ;
  }

  if (typeof jobSeq === "number") {
    return jobSeq + 1;
  }
  return cfg.STARTING_SEQ;
};

/**
 * Computes full next enquiry payload { seq, year, enquiry_no }.
 */
export const computeNextEnquiry = (lastJob, targetYear = getCurrentYearCode(), cfg = ENQUIRY_CONFIG) => {
  const seq = computeNextSeq(lastJob, targetYear, cfg);
  const enquiry_no = formatEnquiryNo(seq, targetYear, cfg);
  return {
    seq,
    year: targetYear,
    enquiry_no,
  };
};

export default ENQUIRY_CONFIG;
