"use strict";

// Phone fields are free text such as "Medical: (206) 461-6950; Dental: (206) 461-6966",
// "988, press 1 for veterans" or "(206) 695-7600\ninfo@acrs.org".
const SEPARATOR = "[\\s.\\-–—]{0,3}";
const NANP_NUMBER = `(?:\\+?1${SEPARATOR})?(?:\\(\\d{3}\\)|\\d{3})${SEPARATOR}\\d{3}${SEPARATOR}\\d{4}`;
const SHORT_CODE = "2-1-1|211|311|711|911|988";
const EMAIL = "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}";
const CONTACT = new RegExp(`(?<![\\d-])(${NANP_NUMBER}|${SHORT_CODE})(?![\\d-])|(${EMAIL})`, "g");

function telHref(number) {
  const digits = number.replace(/\D/g, "");
  if (digits.length === 10) return "tel:+1" + digits;
  if (digits.length === 11) return "tel:+" + digits;
  return "tel:" + digits;
}

// Splits a phone field into plain text and linkable pieces, in order.
function phoneSegments(text) {
  const segments = [];
  let last = 0;
  let match;
  CONTACT.lastIndex = 0;
  while ((match = CONTACT.exec(text)) !== null) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index) });
    const href = match[1] ? telHref(match[1]) : "mailto:" + match[2];
    segments.push({ text: match[0], href: href });
    last = CONTACT.lastIndex;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}

// A number followed by a street name ("2345 N 185th St.", "2707 'I' St. NE"), but not a unit
// number ("No. 100 Kent"), a zip code, or a count ("Level 5 of parking garage").
const STREET_NUMBER = /(?<![\w#.-])(?<!\b(?:No|Suite|Ste|Unit|Room|Apt|Bldg)\.?\s*)\d+[ \t]+(?:-[ \t]+)?(?:[NSEW]{1,2}\.?[ \t]+)?['‘’]?(?:\d+(?:st|nd|rd|th)\b|[A-Z])/g;

// Only an address with exactly one street number gets a map link; fields that list several
// locations, or say "Confidential Location" or "Call for location", stay plain text.
function mapHref(address) {
  const streets = address.match(STREET_NUMBER) || [];
  if (streets.length !== 1) return null;
  let query = address.trim().split(/\s*\n\s*/).filter(Boolean).join(", ").replace(/\s+/g, " ");
  if (!/\b(WA|Washington)\b/i.test(query)) query += ", WA";
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
}

module.exports = { phoneSegments, mapHref };
