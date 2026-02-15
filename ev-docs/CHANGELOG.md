# Değişiklik Kaydı

## 2026-02-15 (v3)
### Düzeltildi
- İşyeri/dükkan (kat=970) profili: eskiden residential alanları atlıyordu, formda aslında hepsi zorunluymuş
- Arsa/tarla (kat=101) profili: yeni alanlar eklendi (imar_durumu, tapu_durumu, kat_izni, imar_orani)
- mapBinaYasi: gelgezgor seçenekleriyle uyumlu hale getirildi ("5-10 arası" formatı, "0" → "Proje Aşamasında")
- CATEGORY_MAP: "tarla", "isyeri" keyword'leri eklendi (satilik-tarla→101, satilik/kiralik-isyeri→970)
- detectCategoryCode typeMap: "tarla" ve "isyeri" keyword'leri eklendi

### Eklendi
- Ticari profil: Depozito, Kiralama Süresi, Kira Ödemesi alanları
- Arsa profili: İmar durumu otomatik tespiti (tarla/zeytinlik/ticari/konut)
- Form alan adları: Oda_sayisi, Esyali, Aidat exact match eklendi

## 2026-02-15 (v2)
### Eklendi
- form-profiles.js — Emlak tipi bazlı modüler form alan tanımları (residential, villa, land, commercial)
- description-parser.js — 101evler açıklamalarından bilgi çıkarma (oda, banyo, m2, kat, özellikler)
- Dry-run modu — Formu doldurup göndermeden keşif yapma
- Tüm zorunlu alanlar: asansör, balkon, ısıtma, kullanım durumu, site içi, aidat, havuz, otopark, kredi, tapu, KDV, takas
- Akıllı varsayılanlar: kat>5 → asansör var, VRF tespiti, bina yaşı 0 → sıfır kullanım

### Değişen
- post.js — Profil bazlı form doldurma sistemi (tek-mantıklı → modüler)
- scrape.js — descriptionText alanı eklendi (clean text)
- server.js — /transfer endpoint'ine dryRun parametresi eklendi
- index.html — Dry Run checkbox'ı ve sonuç görüntüleme eklendi

## 2026-02-15
### Eklendi
- Proje yapısı düzenlendi (CLAUDE.md, commands, hooks, ev-docs, ev-config)
- browser.js — ortak Puppeteer yardımcıları
- scrape.js'e scrapeListing() — metadata + foto çekme
- post.js — gelgezgor.com otomasyon (giriş + ilan gönderme)
- /transfer endpoint — uçtan uca transfer akışı
- Transfer UI — tab'lı arayüz (Photo Scraper | Listing Transfer)
