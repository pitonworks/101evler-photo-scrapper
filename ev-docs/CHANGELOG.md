# Değişiklik Kaydı

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
