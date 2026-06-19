/**
 * Reliable Ethiopian Calendar Utility
 */

const ETHIOPIAN_MONTHS = [
  { en: "Meskerem", am: "መስከረም" },
  { en: "Tikimt", am: "ጥቅምት" },
  { en: "Hidar", am: "ህዳር" },
  { en: "Tahsas", am: "ታህሳስ" },
  { en: "Tir", am: "ጥር" },
  { en: "Yekatit", am: "የካቲት" },
  { en: "Megabit", am: "መጋቢት" },
  { en: "Miazia", am: "ሚያዝያ" },
  { en: "Ginbot", am: "ግንቦት" },
  { en: "Sene", am: "ሰኔ" },
  { en: "Hamle", am: "ሐምሌ" },
  { en: "Nehasse", am: "ነሐሴ" },
  { en: "Pagume", am: "ጳጉሜ" }
];

function getJDN(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

function fromJDN(jdn) {
  const l = jdn + 68569;
  const n = Math.floor((4 * l) / 146097);
  const l1 = l - Math.floor((146097 * n + 3) / 4);
  const i = Math.floor((4000 * (l1 + 1)) / 1461001);
  const l2 = l1 - Math.floor((1461 * i) / 4) + 31;
  const j = Math.floor((80 * l2) / 2447);
  const d = l2 - Math.floor((2447 * j) / 80);
  const l3 = Math.floor(j / 11);
  const m = j + 2 - 12 * l3;
  const y = 100 * (n - 49) + i + l3;
  return new Date(y, m - 1, d);
}

/**
 * Converts Gregorian Date to Ethiopian Date
 */
export function toEthiopian(date) {
  const gDate = new Date(date);
  const jdn = getJDN(gDate.getFullYear(), gDate.getMonth() + 1, gDate.getDate());
  
  const era = 1724221;
  let n = jdn - era;
  
  const r = n % 1461;
  const yearWithinCycle = Math.floor(r / 365);
  const actualYearWithinCycle = r === 1460 ? 3 : yearWithinCycle;
  const year = Math.floor(n / 1461) * 4 + actualYearWithinCycle;

  // Re-calculate n to find month/day
  const dayOfYear = n - (365 * year + Math.floor(year / 4));
  
  let month = Math.floor(dayOfYear / 30) + 1;
  let day = (dayOfYear % 30) + 1;

  if (day <= 0) {
    month--;
    day += 30;
  }

  return {
    year: year + 1,
    month,
    day,
    monthName: ETHIOPIAN_MONTHS[month - 1]
  };
}

/**
 * Converts Ethiopian Date to Gregorian Date
 */
export function toGregorian(year, month, day) {
  const era = 1724221;
  const jdn = (year - 1) * 365 + Math.floor(year / 4) + (month - 1) * 30 + day + era - 1;
  return fromJDN(jdn);
}

/**
 * Returns days in an Ethiopian month
 */
export function getDaysInMonth(year, month) {
  if (month < 13) return 30;
  return (year % 4 === 3) ? 6 : 5;
}

/**
 * Formats a date for display
 */
export function formatEthiopianDate(date, language = 'en') {
  if (!date) return '';
  const ec = toEthiopian(date);
  const monthName = language === 'am' ? ec.monthName.am : ec.monthName.en;
  return language === 'am' ? `${monthName} ${ec.day}፣ ${ec.year}` : `${monthName} ${ec.day}, ${ec.year}`;
}

export { ETHIOPIAN_MONTHS };
