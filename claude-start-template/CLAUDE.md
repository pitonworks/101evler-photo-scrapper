# [PROJECT_NAME]

## Proje

[1-2 sentence project description]

- **GitHub**: [repo URL]

## Slash Commandlar

| Command | Ne yapar |
|---------|----------|
| `/cold-start` | Session baslangici — projeyi oku, durumu raporla |
| `/git-full` | Stage, commit, push — task durumlarini guncelle |
| `/local-testing` | Tum servisleri ayaga kaldir ve dogrula |
| `/turn-off` | Session notu yaz, tasklari isaretle, push, kapat |

---

## Mevcut Durum

**Progress**: 0/7 task (%0) — Phase 0 basliyor.

> Her yeni session'da `_tasks/task-index.md` oku veya `/cold-start` calistir.

---

## Workspace

```
# CUSTOMIZE: Your project structure
# Example:
# apps/api    → Backend (NestJS/Express)
# apps/web    → Frontend (Next.js/Nuxt)
# packages/   → Shared packages
```

## Temel Komutlar

```bash
# CUSTOMIZE: Your project's commands
# pnpm dev                    # Start dev servers
# pnpm build                  # Build all
# pnpm typecheck && pnpm lint # Pre-commit checks
```

---

## Code Conventions (Kisa)

- **TypeScript**: strict, `any` yasak
- **Dosya**: `kebab-case`, `.service.ts` / `.controller.ts` / `.module.ts`
- **API**: RESTful, response `{ data, meta? }`, error `{ error: { statusCode, code, message } }`
- **Commit**: `feat(TASK-XXX): aciklama` + `Co-Authored-By: Claude <noreply@anthropic.com>`

Detaylar → `_config/conventions.md`

## Parallel Agent Orchestration

Birden fazla sub-agent paralel calistirilirken:
- Her agent sadece kendi modul dizininde dosya duzenler (dizin izolasyonu)
- Paket kurulumu sadece ana agent (orchestrator) tarafindan yapilir
- Paylasilan dosyalarda retry pattern uygulanir
- Bagimli task'lar sirali, bagimsiz olanlar paralel calistirilir

Detaylar → `_config/agent-instructions.md`

---

## Referans Dizinleri

| Dizin | Icerik |
|-------|--------|
| `_tasks/` | Task takip — dashboard + tum task'lar |
| `_tasks/task-index.md` | Master task listesi |
| `_tasks/phases/` | Phase bazli detayli task aciklamalari |
| `_tasks/active/session-notes.md` | Session notlari |
| `_config/workflow.md` | Task workflow kurallari |
| `_config/conventions.md` | Kod standartlari |
| `_config/tech-stack.md` | Teknolojiler + versiyonlar |
| `_config/agent-instructions.md` | Sub-agent sorumluluklari |
| `_docs/MEMORY.md` | Kalici hafiza |
| `_docs/CHANGELOG.md` | Degisiklik kaydi |
| `_plans/` | Uygulama planlari |

---

## Hooks (Otomatik Kurallar)

| Hook | Tetikleyici | Ne yapar |
|------|------------|----------|
| `protect-files.sh` | PreToolUse (Edit/Write) | .env, lock files, .git/ duzenlemeyi bloklar |

---

## Notlar

- Hafiza dosyasi `_docs/MEMORY.md`'de — her session'da oku, gerektiginde guncelle
