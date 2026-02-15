# 101evler → gelgezgor.com İlan Transfer Sistemi

## Proje

101evler.com'dan ilan bilgilerini (fotoğraf + tüm detaylar) çekip gelgezgor.com'a otomatik ilan giren bir web uygulaması.

## Slash Commandlar

| Command | Ne yapar |
|---------|----------|
| `/cold-start` | Session başlangıcı — projeyi oku, durumu raporla |
| `/git-full` | Stage, commit, push — task durumlarını güncelle |
| `/turn-off` | Session notu yaz, taskları işaretle, push, kapat |

---

## Workspace

```
server.js        → Express sunucu (API endpoints)
scrape.js        → 101evler scraper (foto + metadata)
browser.js       → Ortak Puppeteer yardımcıları
post.js          → gelgezgor.com otomasyon (giriş + ilan)
public/          → Web arayüzü
ev-docs/         → Proje dökümantasyonu
ev-config/       → Teknik yapılandırma
```

## Temel Komutlar

```bash
npm start              # Sunucuyu başlat (port 3000)
node scrape.js <url> <dir>  # CLI foto çekme
```

---

## Code Conventions (Kısa)

- **JavaScript**: CommonJS (`require`), Node.js 18+
- **Dosya**: kebab-case
- **API**: Express, SSE ile gerçek zamanlı progress
- **Commit**: `feat: açıklama` + `Co-Authored-By: Claude <noreply@anthropic.com>`

## Notlar

- Hafıza dosyası `ev-docs/MEMORY.md`'de — her session'da oku, gerektiğinde güncelle
- `ev-docs/CHANGELOG.md`'de değişiklik kaydı tut
