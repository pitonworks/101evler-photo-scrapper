/**
 * description-parser.js
 * Extracts structured info from 101evler listing descriptions and details.
 * Supports Turkish + English patterns.
 */

function normalizeTurkish(str) {
  return str
    .replace(/İ/g, "I")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

/**
 * Parse room count from text (e.g. "3+1", "4 oda", "3 bedroom")
 */
function parseRoomCount(text) {
  if (!text) return null;
  const n = normalizeTurkish(text);

  // "3+1", "2+1", "4+2" patterns
  const plusMatch = n.match(/(\d)\s*\+\s*(\d)/);
  if (plusMatch) return plusMatch[1] + "+" + plusMatch[2];

  // "3 oda", "4 yatak odasi"
  const odaMatch = n.match(/(\d+)\s*(?:oda|yatak\s*odasi)/);
  if (odaMatch) return odaMatch[1];

  // "3 bedroom", "4 bed"
  const bedMatch = n.match(/(\d+)\s*(?:bedroom|bed\b)/);
  if (bedMatch) return bedMatch[1];

  // "studio", "stüdyo"
  if (n.includes("studio") || n.includes("studyo")) return "1+0";

  return null;
}

/**
 * Parse bathroom count from text
 */
function parseBathCount(text) {
  if (!text) return null;
  const n = normalizeTurkish(text);

  // "2 banyo", "1 banyo"
  const banyoMatch = n.match(/(\d+)\s*banyo/);
  if (banyoMatch) return banyoMatch[1];

  // "2 bathroom", "1 bath"
  const bathMatch = n.match(/(\d+)\s*(?:bathroom|bath\b)/);
  if (bathMatch) return bathMatch[1];

  return null;
}

/**
 * Parse area/square meters from text
 */
function parseArea(text) {
  if (!text) return null;
  const n = normalizeTurkish(text);

  // "150m2", "150 m²", "150m²", "150 m2"
  const m2Match = n.match(/(\d[\d.,]*)\s*m[²2]/);
  if (m2Match) return m2Match[1].replace(/[.,]/g, "");

  // "150 sqm", "150 square meters"
  const sqmMatch = n.match(/(\d[\d.,]*)\s*(?:sqm|sq\.?\s*m|square\s*met)/);
  if (sqmMatch) return sqmMatch[1].replace(/[.,]/g, "");

  // "150 donum", "2 dönüm" (for land)
  const donumMatch = n.match(/(\d[\d.,]*)\s*don[u|ü]m/);
  if (donumMatch) return donumMatch[1].replace(/[.,]/g, "");

  return null;
}

/**
 * Parse floor info from text
 */
function parseFloor(text) {
  if (!text) return null;
  const n = normalizeTurkish(text);

  // "zemin kat", "ground floor"
  if (n.includes("zemin kat") || n.includes("ground floor")) return "Zemin";

  // "bodrum", "basement"
  if (n.includes("bodrum") || n.includes("basement")) return "Bodrum";

  // "cati", "penthouse", "top floor"
  if (n.includes("cati kat") || n.includes("penthouse") || n.includes("top floor")) return "Cati";

  // "3. kat", "5. kat"
  const katMatch = n.match(/(\d+)\s*\.?\s*kat/);
  if (katMatch) return katMatch[1];

  // "3rd floor", "5th floor"
  const floorMatch = n.match(/(\d+)\s*(?:st|nd|rd|th)\s*floor/);
  if (floorMatch) return floorMatch[1];

  return null;
}

/**
 * Parse features/amenities from text
 */
function parseFeatures(text) {
  if (!text) return [];
  const n = normalizeTurkish(text);
  const features = [];

  const featurePatterns = [
    [/havuz/i, "Havuzlu"],
    [/pool/i, "Havuzlu"],
    [/deniz\s*manzara/i, "Deniz Manzarali"],
    [/sea\s*view/i, "Deniz Manzarali"],
    [/dag\s*manzara/i, "Dag Manzarali"],
    [/mountain\s*view/i, "Dag Manzarali"],
    [/klima/i, "Klimali"],
    [/air\s*condition/i, "Klimali"],
    [/otopark|garaj/i, "Otoparkli"],
    [/parking|garage/i, "Otoparkli"],
    [/asansor/i, "Asansorlu"],
    [/elevator|lift/i, "Asansorlu"],
    [/bahce/i, "Bahceli"],
    [/garden/i, "Bahceli"],
    [/teras/i, "Terasli"],
    [/terrace/i, "Terasli"],
    [/balkon/i, "Balkonlu"],
    [/balcon/i, "Balkonlu"],
    [/guvenlik/i, "Guvenlikli"],
    [/security/i, "Guvenlikli"],
    [/jenerator/i, "Jeneratorlu"],
    [/generator/i, "Jeneratorlu"],
    [/gunes\s*enerjisi|solar/i, "Gunes Enerjili"],
    [/merkezi\s*isitma|central\s*heat/i, "Merkezi Isitma"],
    [/soba|fireplace|somine/i, "Sobali"],
    [/beyaz\s*esya|white\s*goods/i, "Beyaz Esyali"],
    [/mobilya|furnished/i, "Mobilyali"],
  ];

  for (const [pattern, label] of featurePatterns) {
    if (pattern.test(n)) {
      features.push(label);
    }
  }

  return [...new Set(features)];
}

/**
 * Parse address hints (district, neighborhood) from text
 */
function parseAddress(text) {
  if (!text) return {};
  const result = {};

  // Common KKTC districts
  const districts = [
    "Alsancak", "Catalkoy", "Catalköy", "Edremit", "Karşıyaka", "Karsiyaka",
    "Lapta", "Ozanköy", "Ozankoy", "Bellapais", "Beylerbeyi",
    "Karakum", "Zeytinlik", "Arapköy", "Arapkoy", "Dikmen",
    "Bogaz", "Boğaz", "Bafra", "Tatlisu", "Tatlısu",
    "Yenibogazici", "Yeniboğaziçi", "Mehmetcik", "Mehmetçik",
    "Gecitkale", "Geçitkale", "Akdogan", "Akdoğan",
    "Gonyeli", "Gönyeli", "Hamitköy", "Hamitkoy",
    "Yenisehir", "Yenişehir", "Kumsal", "Ortaköy", "Ortakoy",
    "Marmara", "Kaymakli", "Kaymaklı", "Kizilbas", "Kızılbaş",
    "Haspolat", "Alayköy", "Alaykoy", "Degirmenlik", "Değirmenlik",
    "Famagusta", "Sakarya", "Baykal", "Çanakkale", "Canakkale",
    "Maras", "Maraş", "Yeniiskele", "Yeniİskele",
    "Guzelyurt", "Güzelyurt", "Lefke", "Morphou"
  ];

  const normalized = normalizeTurkish(text);
  for (const d of districts) {
    if (normalized.includes(normalizeTurkish(d))) {
      result.district = d;
      break;
    }
  }

  return result;
}

/**
 * Parse furnished status from text
 */
function parseFurnished(text) {
  if (!text) return null;
  const n = normalizeTurkish(text);

  if (n.includes("esyali") || n.includes("mobilyali") || n.includes("furnished")) {
    // Check for negative
    if (n.includes("esyasiz") || n.includes("unfurnished") || n.includes("mobilyasiz")) {
      return "Eşyasız";
    }
    return "Eşyalı";
  }
  if (n.includes("esyasiz") || n.includes("unfurnished") || n.includes("mobilyasiz")) {
    return "Eşyasız";
  }

  return null;
}

/**
 * Parse building age from text
 */
function parseBuildingAge(text) {
  if (!text) return null;
  const n = normalizeTurkish(text);

  // "sifir bina", "yeni bina", "new building"
  if (n.includes("sifir") || n.includes("yeni bina") || n.includes("new build")) return "0";

  // "5 yaşında", "10 yıllık"
  const yasMatch = n.match(/(\d+)\s*(?:yasinda|yillik|years?\s*old)/);
  if (yasMatch) return yasMatch[1];

  // "5-10 yıl"
  const rangeMatch = n.match(/(\d+)\s*-\s*(\d+)\s*(?:yil|year)/);
  if (rangeMatch) return rangeMatch[2]; // upper bound

  return null;
}

/**
 * Parse total floor count from text
 */
function parseTotalFloors(text) {
  if (!text) return null;
  const n = normalizeTurkish(text);

  // "3 katli", "5 katlı"
  const katliMatch = n.match(/(\d+)\s*katli/);
  if (katliMatch) return katliMatch[1];

  // "3 story", "5 storey"
  const storyMatch = n.match(/(\d+)\s*stor(?:e?y|ies)/);
  if (storyMatch) return storyMatch[1];

  return null;
}

/**
 * Enrich metadata by parsing description text and filling in missing details.
 * Mutates metadata.details in place.
 * @param {object} metadata - Listing metadata from scrape.js
 * @returns {object} metadata (same reference, enriched)
 */
function enrichMetadata(metadata) {
  if (!metadata) return metadata;

  const details = metadata.details || {};
  const text = (metadata.descriptionText || "") + " " + (metadata.aciklama || "").replace(/<[^>]*>/g, " ");

  // Only fill in missing values
  const detailsNorm = {};
  for (const [k, v] of Object.entries(details)) {
    detailsNorm[normalizeTurkish(k)] = v;
  }

  // Room count
  if (!detailsNorm["oda sayisi"] && !detailsNorm["oda"]) {
    const rooms = parseRoomCount(text);
    if (rooms) details["Oda Sayısı"] = rooms;
  }

  // Bathroom count
  if (!detailsNorm["banyo sayisi"] && !detailsNorm["banyo"]) {
    const baths = parseBathCount(text);
    if (baths) details["Banyo Sayısı"] = baths;
  }

  // Area
  if (!detailsNorm["m2"] && !detailsNorm["m²"] && !detailsNorm["metrekare"] && !detailsNorm["net m²"] && !detailsNorm["alan olcusu"]) {
    const area = parseArea(text);
    if (area) details["m²"] = area;
  }

  // Floor
  if (!detailsNorm["bulundugu kat"] && !detailsNorm["kat"]) {
    const floor = parseFloor(text);
    if (floor) details["Bulunduğu Kat"] = floor;
  }

  // Total floors
  if (!detailsNorm["kat sayisi"] && !detailsNorm["toplam kat"]) {
    const totalFloors = parseTotalFloors(text);
    if (totalFloors) details["Kat Sayısı"] = totalFloors;
  }

  // Furnished
  if (!detailsNorm["esya durumu"] && !detailsNorm["esyali"]) {
    const furnished = parseFurnished(text);
    if (furnished) details["Eşya Durumu"] = furnished;
  }

  // Building age
  if (!detailsNorm["bina yasi"]) {
    const age = parseBuildingAge(text);
    if (age) details["Bina Yaşı"] = age;
  }

  // District from description if not already set
  if (!metadata.district) {
    const addr = parseAddress(text);
    if (addr.district) metadata.district = addr.district;
  }

  // Features (always additive)
  metadata.features = parseFeatures(text);

  metadata.details = details;
  return metadata;
}

module.exports = {
  parseRoomCount,
  parseBathCount,
  parseArea,
  parseFloor,
  parseFeatures,
  parseAddress,
  parseFurnished,
  parseBuildingAge,
  parseTotalFloors,
  enrichMetadata,
};
