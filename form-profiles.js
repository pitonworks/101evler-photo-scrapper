/**
 * form-profiles.js
 * Property type-based form field profiles for gelgezgor.com.
 * Maps 101evler metadata to gelgezgor form fields per property type.
 *
 * Zorunlu alanlar (residential):
 *   Başlık, Fiyat, Para Birimi, İl, İlçe, Oda Sayısı, Bina Yaşı,
 *   Kat Sayısı, Bulunduğu Kat, Asansör, Banyo Sayısı, Balkon Sayısı,
 *   Isıtma, Eşyalı, Kullanım Durumu, Site İçi, Aidat, Havuz, Otopark,
 *   Krediye Uygun, Kimden, Tapu Türü, KDV-Trafo, Takas, Açıklama, Metrekare
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
 * Map raw building age value to gelgezgor.com select options.
 * Actual options: Belirtilmemiş, Proje Aşamasında, 1, 2, 3, 4, 5, 6-10 arası, 11-15 arası, 16-20 arası, 21-25 arası, 26-30 arası, 31 ve üzeri
 */
function mapBinaYasi(raw) {
  if (!raw) return "Belirtilmemiş";
  const normalized = normalizeTurkish(String(raw).trim());

  if (normalized === "belirtilmemis" || normalized === "-") return "Belirtilmemiş";
  if (normalized.includes("proje")) return "Proje Aşamasında";
  if (normalized === "sifir" || normalized === "yeni") return "Proje Aşamasında";

  const num = parseInt(raw, 10);
  if (isNaN(num)) return "Belirtilmemiş";

  if (num === 0) return "Proje Aşamasında";
  if (num >= 1 && num <= 5) return String(num);
  if (num <= 10) return "6-10 arası";
  if (num <= 15) return "11-15 arası";
  if (num <= 20) return "16-20 arası";
  if (num <= 25) return "21-25 arası";
  if (num <= 30) return "26-30 arası";
  return "31 ve üzeri";
}

// Shared field definitions to avoid repetition
const COMMON_FIELDS = {
  baslik: {
    required: true,
    source: "baslik",
    formNames: ["baslik", "ilan_baslik", "title"],
  },
  fiyat: {
    required: true,
    source: "fiyat",
    formNames: ["fiyat", "price"],
  },
  para_birimi: {
    required: true,
    source: "paraBirimi",
    formNames: ["para_birimi", "currency"],
  },
  il: {
    required: true,
    source: "cityId",
    formNames: ["il", "sehir", "city"],
  },
  ilce: {
    required: true,
    source: "district",
    formNames: ["ilce", "ilçe", "district", "semt"],
  },
  metrekare: {
    required: true,
    source: "details.m²",
    sourceAlt: ["details.m2", "details.Metrekare", "details.metrekare", "details.net m²", "details.Alan Ölçüsü", "details.alan olcusu"],
    extract: /(\d[\d.,]*)/,
    formNames: ["metrekare", "m2", "alan"],
  },
  kimden: {
    required: true,
    default: "Emlak Ofisi",
    formNames: ["kimden"],
  },
  aciklama: {
    required: false,
    source: "aciklama",
    formNames: ["aciklama", "icerik", "description", "detay"],
  },
};

// Residential-specific fields (also used by villa with minor differences)
const RESIDENTIAL_FIELDS = {
  ...COMMON_FIELDS,
  oda_sayisi: {
    required: true,
    source: "details.Oda Sayısı",
    sourceAlt: ["details.oda sayısı", "details.oda sayisi", "details.oda", "details.Oda"],
    formNames: ["Oda_sayisi", "oda_sayisi", "oda", "rooms"],
  },
  bina_yasi: {
    required: true,
    source: "details.Bina Yaşı",
    sourceAlt: ["details.bina yasi", "details.bina yaşı"],
    formNames: ["bina_yasi", "yasi"],
    transform: mapBinaYasi,
    default: "Belirtilmemiş",
  },
  kat_sayisi: {
    required: true,
    source: "details.Kat Sayısı",
    sourceAlt: ["details.kat sayisi", "details.kat sayısı", "details.toplam kat"],
    formNames: ["kat_sayisi", "toplam_kat"],
  },
  bulundugu_kat: {
    required: true,
    source: "details.Bulunduğu Kat",
    sourceAlt: ["details.bulundugu kat", "details.bulunduğu kat", "details.kat"],
    formNames: ["bulundugu_kat", "kat"],
  },
  asansor: {
    required: true,
    // Derived: kat sayısı > 5 → Var, <= 3 → Hayır, arası → Belirtilmemiş
    source: "_derived.asansor",
    default: "Hayır",
    formNames: ["Asansör", "asansor", "asansör", "elevator"],
  },
  banyo_sayisi: {
    required: true,
    source: "details.Banyo Sayısı",
    sourceAlt: ["details.banyo sayısı", "details.banyo sayisi", "details.banyo", "details.Banyo"],
    formNames: ["banyo_sayisi", "banyo", "bathrooms"],
    default: "1",
  },
  balkon_sayisi: {
    required: true,
    default: "1",
    formNames: ["balkon_sayisi", "balkon"],
  },
  isitma: {
    required: true,
    // Açıklamada VRF varsa "VRF", yoksa "Klima"
    source: "_derived.isitma",
    default: "Klima",
    formNames: ["isitma", "ısıtma", "heating"],
  },
  esyali: {
    required: true,
    source: "details.Eşya Durumu",
    sourceAlt: ["details.esya durumu", "details.eşyalı", "details.esyali"],
    default: "Belirtilmemiş",
    // 101evler → gelgezgor eşya durumu eşleştirmesi
    valueMap: { "-": "Belirtilmemiş", "Eşyasız": "Hayır", "Eşyalı": "Evet" },
    formNames: ["Esyali", "esyali", "eşyalı", "furnished"],
  },
  kullanim_durumu: {
    required: true,
    // Bina yaşı 0 ise "Sıfır", değilse "Boş"
    source: "_derived.kullanimDurumu",
    default: "Boş",
    formNames: ["kullanim_durumu", "kullanım_durumu"],
  },
  site_ici: {
    required: true,
    // Açıklamada site/complex varsa "Evet", yoksa "Hayır"
    source: "_derived.siteIci",
    default: "Hayır",
    formNames: ["site_ici", "site_içi", "site"],
  },
  aidat: {
    required: true,
    source: "details.Aidat",
    sourceAlt: ["details.aidat"],
    default: "-",
    formNames: ["Aidat", "aidat"],
  },
  havuz: {
    required: true,
    source: "_derived.havuz",
    default: "Hayır",
    formNames: ["Havuz", "havuz", "pool"],
  },
  otopark: {
    required: true,
    source: "_derived.otopark",
    default: "Açık Otopark",
    formNames: ["Otopark", "otopark", "parking"],
  },
  krediye_uygun: {
    required: true,
    default: "Belirtilmemiş",
    formNames: ["krediye_uygun", "kredi"],
  },
  tapu_turu: {
    required: true,
    source: "details.Tapu Türü",
    sourceAlt: ["details.tapu turu", "details.tapu türü"],
    default: "Belirtilmemiş",
    formNames: ["tapu_turu", "tapu_türü", "tapu"],
  },
  kdv_trafo: {
    required: true,
    source: "_derived.kdvTrafo",
    default: "Belirtilmemiş",
    formNames: ["Kdv-Trafo", "kdv_trafo", "kdv"],
  },
  takas: {
    required: true,
    default: "Hayır",
    formNames: ["takas"],
  },
  arsa_metrekaresi: {
    required: false,
    source: "details.m²",
    sourceAlt: ["details.m2", "details.Alan Ölçüsü", "details.alan olcusu", "details.Metrekare"],
    extract: /(\d[\d.,]*)/,
    formNames: ["arsa_metrekaresi"],
  },
};

/**
 * Map 101evler "En Az Kiralama" / "Kira Ödeme Aralığı" to gelgezgor select values.
 * gelgezgor options: Belirtilmemiş, Aylık, 3 Aylık, 6 Aylık, 1 yıl, 2 yıl, 3 yıl, 4 yıl, 5 yıl
 */
function mapRentalPeriod(raw) {
  if (!raw) return "Belirtilmemiş";
  const n = normalizeTurkish(raw);
  // Check longer patterns first to avoid partial matches
  if (/6\s*aylik/.test(n)) return "6 Aylık";
  if (/3\s*aylik/.test(n)) return "3 Aylık";
  if (/aylik/.test(n)) return "Aylık";
  const yearMatch = n.match(/(\d+)\s*yil/);
  if (yearMatch) return yearMatch[1] + " yıl";
  return "Belirtilmemiş";
}

// Rental-specific fields (kiralık formlarda zorunlu)
const RENTAL_FIELDS = {
  depozito: {
    required: true,
    default: "1 Kira Bedeli",
    formNames: ["Depotizo", "depotizo", "Depozito", "depozito"],
  },
  kiralama_suresi: {
    required: true,
    source: "details.En Az Kiralama",
    sourceAlt: ["details.en az kiralama", "details.Kiralama Süresi", "details.kiralama suresi"],
    transform: mapRentalPeriod,
    default: "1 yıl",
    formNames: ["Kiralama_Suresi", "kiralama_suresi", "Kiralamasüresi_", "kiralama"],
  },
  kira_odemesi: {
    required: true,
    source: "details.Kira Ödeme Aralığı",
    sourceAlt: ["details.kira odeme araligi", "details.Kira Ödeme Araligi", "details.Ödeme Şekli"],
    transform: mapRentalPeriod,
    default: "Aylık",
    formNames: ["Kira_odemesi", "kira_odemesi"],
  },
};

const PROFILES = {
  residential: {
    label: "Konut (Daire, Studio, Müstakil Ev, Penthouse)",
    katCodes: [901, 902, 903, 912, 914, 18260, 19100],
    fields: { ...RESIDENTIAL_FIELDS },
  },

  villa: {
    label: "Villa (Villa, İkiz Villa)",
    katCodes: [904, 915, 19633],
    fields: {
      ...RESIDENTIAL_FIELDS,
      // Villa'da bulunduğu kat genelde zorunlu değil
      bulundugu_kat: {
        ...RESIDENTIAL_FIELDS.bulundugu_kat,
        required: false,
      },
      // Villa'da arsa metrekaresi = 101evler "Arsa Büyüklüğü", yoksa "-"
      arsa_metrekaresi: {
        required: true,
        source: "details.Arsa Büyüklüğü",
        sourceAlt: ["details.arsa büyüklüğü", "details.arsa buyuklugu", "details.Arsa Büyüklügü", "details.arsa metrekaresi"],
        extract: /(\d[\d.,]*)/,
        default: "-",
        formNames: ["arsa_metrekaresi"],
      },
    },
  },

  land: {
    label: "Arsa / Tarla",
    katCodes: [101],
    fields: {
      ...COMMON_FIELDS,
      imar_durumu: {
        required: true,
        source: "details.İmar Durumu",
        sourceAlt: ["details.imar durumu", "details.Imar Durumu", "_derived.imarDurumu"],
        default: "Konut",
        formNames: ["imar_durumu"],
      },
      tapu_durumu: {
        required: true,
        source: "details.Tapu Türü",
        sourceAlt: ["details.tapu turu", "details.tapu türü", "details.tapu durumu", "details.Tapu Durumu"],
        default: "Belirtilmemiş",
        formNames: ["tapu_durumu"],
      },
      kat_izni: {
        required: true,
        source: "details.Kat İzni",
        sourceAlt: ["details.kat izni", "details.Kat Izni", "details.kat İzni"],
        default: "Belirtilmemiş",
        formNames: ["kat_izni"],
      },
      imar_orani: {
        required: true,
        default: "Belirtilmemiş",
        formNames: ["imar_orani"],
      },
      krediye_uygun: {
        required: true,
        default: "Evet",
        formNames: ["krediye_uygun", "kredi"],
      },
      takas: {
        required: true,
        default: "Hayır",
        formNames: ["takas"],
      },
      metrekare_fiyati: {
        required: false,
        source: "details.m² Fiyatı",
        sourceAlt: ["details.m2 fiyati", "details.m² fiyati", "details.Metrekare Fiyatı", "details.metrekare fiyati"],
        extract: /(\d[\d.,]*)/,
        formNames: ["metrekare_fiyati", "m2_fiyati"],
      },
    },
    skippedFields: [
      "oda_sayisi", "banyo_sayisi", "bina_yasi", "kat_sayisi",
      "bulundugu_kat", "esyali", "asansor", "balkon_sayisi",
      "isitma", "kullanim_durumu", "site_ici", "aidat",
      "havuz", "otopark", "tapu_turu", "kdv_trafo",
      "arsa_metrekaresi",
    ],
  },

  hotel: {
    label: "Turistik Tesis (Otel, Hotel)",
    katCodes: [1162],
    fields: {
      ...COMMON_FIELDS,
      acik_metrekare: {
        required: false,
        source: "details.m²",
        sourceAlt: ["details.m2", "details.Metrekare", "details.Alan Ölçüsü", "details.alan olcusu"],
        extract: /(\d[\d.,]*)/,
        formNames: ["acik_metrekare"],
      },
      kapali_metrekare: {
        required: true,
        source: "details.net m²",
        sourceAlt: ["details.net m2", "details.Kapalı Alan", "details.m²", "details.Metrekare", "details.Alan Ölçüsü"],
        extract: /(\d[\d.,]*)/,
        default: "-",
        formNames: ["kapali_metrekare"],
      },
      yatak_sayisi: {
        required: true,
        source: "details.Yatak Sayısı",
        sourceAlt: ["details.yatak sayisi", "details.yatak sayısı", "details.Oda Sayısı", "details.oda sayısı"],
        default: "Belirtilmemiş",
        formNames: ["yatak_sayisi", "yatak"],
      },
      zemin_etudu: {
        required: false,
        default: "Belirtilmemiş",
        formNames: ["zemin_etudu"],
      },
      oda_sayisi: {
        required: true,
        source: "details.Oda Sayısı",
        sourceAlt: ["details.oda sayısı", "details.oda sayisi", "details.oda", "details.Oda"],
        formNames: ["Oda_sayisi", "oda_sayisi", "oda", "rooms"],
        default: "Belirtilmemiş",
      },
      bina_yasi: {
        required: true,
        source: "details.Bina Yaşı",
        sourceAlt: ["details.bina yasi", "details.bina yaşı"],
        formNames: ["bina_yasi", "yasi"],
        transform: mapBinaYasi,
        default: "Belirtilmemiş",
      },
      kat_sayisi: {
        required: true,
        source: "details.Kat Sayısı",
        sourceAlt: ["details.kat sayisi", "details.kat sayısı", "details.toplam kat"],
        formNames: ["kat_sayisi", "toplam_kat"],
      },
      banyo_sayisi: {
        required: true,
        source: "details.Banyo Sayısı",
        sourceAlt: ["details.banyo sayısı", "details.banyo sayisi", "details.banyo", "details.Banyo"],
        formNames: ["banyo_sayisi", "banyo", "bathrooms"],
        default: "1",
      },
      asansor: {
        required: true,
        source: "_derived.asansor",
        default: "Hayır",
        formNames: ["Asansör", "asansor", "asansör", "elevator"],
      },
      isitma: {
        required: true,
        source: "_derived.isitma",
        default: "Klima",
        formNames: ["isitma", "ısıtma", "heating"],
      },
      esyali: {
        required: true,
        source: "details.Eşya Durumu",
        sourceAlt: ["details.esya durumu", "details.eşyalı", "details.esyali"],
        default: "Belirtilmemiş",
        valueMap: { "-": "Belirtilmemiş", "Eşyasız": "Hayır", "Eşyalı": "Evet" },
        formNames: ["Esyali", "esyali", "eşyalı", "furnished"],
      },
      havuz: {
        required: true,
        source: "_derived.havuz",
        default: "Hayır",
        formNames: ["Havuz", "havuz", "pool"],
      },
      tapu_turu: {
        required: true,
        source: "details.Tapu Türü",
        sourceAlt: ["details.tapu turu", "details.tapu türü"],
        default: "Belirtilmemiş",
        formNames: ["tapu_turu", "tapu_türü", "tapu"],
      },
      kdv_trafo: {
        required: true,
        source: "_derived.kdvTrafo",
        default: "Belirtilmemiş",
        formNames: ["Kdv-Trafo", "kdv_trafo", "kdv"],
      },
      takas: {
        required: true,
        default: "Hayır",
        formNames: ["takas"],
      },
    },
  },

  commercial: {
    label: "Ticari (Dükkan, İşyeri)",
    katCodes: [970],
    fields: {
      ...RESIDENTIAL_FIELDS,
      // Dükkan: oda sayısı genelde belirsiz
      oda_sayisi: {
        ...RESIDENTIAL_FIELDS.oda_sayisi,
        default: "Belirtilmemiş",
      },
      // Rental-specific fields (kat=970 formunda zorunlu)
      ...RENTAL_FIELDS,
    },
    // kat=970 formunda olmayan alanlar
    skippedFields: [
      "havuz", "krediye_uygun", "tapu_turu", "kdv_trafo", "takas",
      "arsa_metrekaresi",
    ],
  },
};

/**
 * Derive smart defaults from metadata context.
 * Called before mapping to fill in _derived fields.
 */
function deriveFields(metadata) {
  const details = metadata.details || {};
  const text = normalizeTurkish(
    (metadata.descriptionText || "") + " " +
    (metadata.aciklama || "").replace(/<[^>]*>/g, " ")
  );

  const derived = {};

  // Asansör: kat sayısı > 5 → Var, <= 3 → Hayır, arası → Belirtilmemiş
  const katSayisi = parseInt(
    details["Kat Sayısı"] || details["kat sayısı"] ||
    details["kat sayisi"] || details["toplam kat"] || "0"
  );
  if (katSayisi >= 5) derived.asansor = "Var";
  else if (katSayisi <= 3 && katSayisi > 0) derived.asansor = "Hayır";
  else derived.asansor = "Belirtilmemiş";

  // Isıtma: VRF varsa VRF, yoksa Klima
  if (text.includes("vrf")) {
    derived.isitma = "VRF";
  } else if (text.includes("merkezi isitma") || text.includes("central heat")) {
    derived.isitma = "Merkezi";
  } else {
    derived.isitma = "Klima";
  }

  // Kullanım durumu: bina yaşı 0 veya proje aşamasında ise Sıfır, değilse Boş
  const binaYasi = normalizeTurkish(
    details["Bina Yaşı"] || details["bina yaşı"] || details["bina yasi"] || ""
  );
  derived.kullanimDurumu =
    (binaYasi === "0" || binaYasi === "sifir" || binaYasi.includes("proje"))
      ? "Sıfır" : "Boş";

  // Site içi: açıklamada site/complex/residence varsa Evet
  if (text.includes("site") || text.includes("complex") || text.includes("residence")) {
    derived.siteIci = "Evet";
  } else {
    derived.siteIci = "Hayır";
  }

  // Havuz
  if (text.includes("ozel havuz") || text.includes("private pool")) {
    derived.havuz = "Özel";
  } else if (text.includes("ortak havuz") || text.includes("communal pool") || text.includes("common pool")) {
    derived.havuz = "Ortak";
  } else if (text.includes("havuz") || text.includes("pool")) {
    derived.havuz = "Ortak";
  } else {
    derived.havuz = "Hayır";
  }

  // Otopark: genelde açık, bazen kapalı
  if (text.includes("kapali otopark") || text.includes("kapali garaj") || text.includes("closed parking") || text.includes("indoor parking")) {
    derived.otopark = "Kapalı ve Açık Otopark";
  } else {
    derived.otopark = "Açık Otopark";
  }

  // KDV-Trafo: açıklama + detaylardan tespit
  const kdvTrafoText = normalizeTurkish(
    text + " " + (metadata.baslik || "") + " " + JSON.stringify(details)
  );
  const hasKdv = /kdv\s*(?:odenmis|odenmi[sş]|dahil|paid|included)/.test(kdvTrafoText)
    || /vergiler?\s*(?:odenmis|odenmi[sş]|dahil)/.test(kdvTrafoText);
  const hasTrafo = /trafo\s*(?:odenmis|odenmi[sş]|dahil|paid|included)/.test(kdvTrafoText)
    || /altyapi\s*(?:odenmis|odenmi[sş]|dahil)/.test(kdvTrafoText);

  if (hasKdv && hasTrafo) {
    derived.kdvTrafo = "KDV ve Trafo Ödenmiş";
  } else if (hasKdv) {
    derived.kdvTrafo = "KDV Ödenmiş";
  } else if (hasTrafo) {
    derived.kdvTrafo = "Trafo Ödenmiş";
  } else {
    derived.kdvTrafo = "Belirtilmemiş";
  }

  // İmar durumu: arsa/tarla için URL/başlık/detaylardan tespit
  if (metadata.katCode === 101) {
    const combined = normalizeTurkish(
      (metadata.baslik || "") + " " + JSON.stringify(metadata.details || {})
    );
    if (combined.includes("tarla")) {
      derived.imarDurumu = "Tarla";
    } else if (combined.includes("zeytinlik")) {
      derived.imarDurumu = "Zeytinlik";
    } else if (combined.includes("ticari")) {
      derived.imarDurumu = "Ticari";
    } else {
      derived.imarDurumu = "Konut";
    }
  }

  metadata._derived = derived;
  return metadata;
}

/**
 * Resolve a dot-path value from an object.
 * e.g. getNestedValue(metadata, "details.Oda Sayısı")
 */
function getNestedValue(obj, dotPath) {
  if (!dotPath || !obj) return undefined;
  const parts = dotPath.split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
    // Try case-insensitive match
    if (current === undefined && typeof current !== "undefined") break;
    if (current === undefined) {
      // Find parent and try normalized key match
      let parent = obj;
      for (let i = 0; i < parts.indexOf(part); i++) {
        parent = parent && parent[parts[i]];
      }
      if (parent && typeof parent === "object") {
        const normKey = normalizeTurkish(part);
        for (const k of Object.keys(parent)) {
          if (normalizeTurkish(k) === normKey) {
            current = parent[k];
            break;
          }
        }
      }
    }
  }
  return current;
}

/**
 * Get the profile for a given katCode.
 * @param {number} katCode
 * @param {string} [saleType] - "satilik" or "kiralik"
 */
function getProfile(katCode, saleType) {
  const code = Number(katCode);
  let matched = null;
  let type = "residential";
  for (const [key, profile] of Object.entries(PROFILES)) {
    if (profile.katCodes.includes(code)) {
      matched = profile;
      type = key;
      break;
    }
  }
  if (!matched) matched = PROFILES.residential;

  const result = { ...matched, type, fields: { ...matched.fields } };

  // Inject rental-specific fields for kiralık listings
  if (saleType === "kiralik" && type !== "commercial") {
    Object.assign(result.fields, RENTAL_FIELDS);
  }

  return result;
}

/**
 * Map metadata to form values based on a profile.
 * @param {object} profile - from getProfile()
 * @param {object} metadata - enriched metadata (with _derived fields)
 * @returns {{ values: object, warnings: string[] }}
 */
function mapMetadataToForm(profile, metadata) {
  const values = {};
  const warnings = [];

  for (const [fieldName, fieldDef] of Object.entries(profile.fields)) {
    let value = null;

    // Try primary source
    if (fieldDef.source) {
      value = getNestedValue(metadata, fieldDef.source);
    }

    // Try alternative sources
    if ((value === undefined || value === null || value === "") && fieldDef.sourceAlt) {
      for (const alt of fieldDef.sourceAlt) {
        value = getNestedValue(metadata, alt);
        if (value !== undefined && value !== null && value !== "") break;
      }
    }

    // Apply extract regex
    if (value && fieldDef.extract && typeof value === "string") {
      const match = value.match(fieldDef.extract);
      if (match) value = match[1];
    }

    // Apply valueMap (e.g. "-" → "Belirtilmemiş")
    if (value && fieldDef.valueMap && fieldDef.valueMap[value]) {
      value = fieldDef.valueMap[value];
    }

    // Apply transform function (e.g. bina yaşı range mapping)
    if (fieldDef.transform) {
      value = fieldDef.transform(value);
    }

    // Apply default
    if ((value === undefined || value === null || value === "") && fieldDef.default) {
      value = fieldDef.default;
    }

    // Convert to string
    if (value !== undefined && value !== null) {
      value = String(value);
    }

    if (value && value.trim()) {
      values[fieldName] = {
        value: value.trim(),
        formNames: fieldDef.formNames,
        required: fieldDef.required,
      };
    } else if (fieldDef.required) {
      warnings.push(`Zorunlu alan boş: ${fieldName}`);
    }
  }

  return { values, warnings };
}

/**
 * Get fields that should be skipped for a given katCode.
 */
function getSkippedFields(katCode) {
  const profile = getProfile(katCode);
  return profile.skippedFields || [];
}

/**
 * Get all supported katCodes grouped by type.
 */
function getAllProfiles() {
  return Object.entries(PROFILES).map(([type, profile]) => ({
    type,
    label: profile.label,
    katCodes: profile.katCodes,
    fieldCount: Object.keys(profile.fields).length,
    requiredFields: Object.entries(profile.fields)
      .filter(([, f]) => f.required)
      .map(([name]) => name),
  }));
}

module.exports = {
  getProfile,
  mapMetadataToForm,
  getSkippedFields,
  getAllProfiles,
  deriveFields,
  mapBinaYasi,
  PROFILES,
};
