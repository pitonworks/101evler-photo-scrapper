# Claude Code Project Blueprint

> Bu dosya herhangi bir projeye Claude Code ile yapılandırılmış bir iş akışı kurmak için kullanılır.
> Yeni proje başlatırken Claude Code'a: **"BLUEPRINT.md oku ve bu projeye uygula"** de.

---

## Nasıl Kullanılır

1. Yeni proje dizininde `git init` ve temel scaffold'u kur
2. Bu dosyayı projenin kök dizinine kopyala
3. Claude Code aç ve de ki: _"BLUEPRINT.md dosyasını oku, bu projeye göre tüm yapıyı kur. Proje adı: [X], kısa açıklama: [Y]"_
4. Claude tüm dizinleri, dosyaları ve konfigürasyonları oluşturur
5. BLUEPRINT.md'yi silebilir veya `docs/` altına taşıyabilirsin

---

## 1. Dizin Yapısı

Aşağıdaki meta-dizinler proje kökünde oluşturulur. **Bunlar kod dizinleri DEĞİL** — Claude Code'un çalışma hafızası ve iş akışı dosyaları.

```
project-root/
├── .claude/
│   ├── commands/          # Slash command dosyaları
│   │   ├── cold-start.md
│   │   ├── git-full.md
│   │   ├── turn-off.md
│   │   └── local-testing.md
│   ├── hooks/             # Otomatik kurallar (shell script)
│   │   └── protect-files.sh
│   └── settings.local.json
│
├── project-tasks/         # Task tracking sistemi
│   ├── task-index.md      # Master liste + dashboard
│   ├── phases/            # Phase bazlı detaylı task dosyaları
│   │   ├── phase-0.md
│   │   ├── phase-1.md
│   │   └── ...
│   └── active/
│       └── session-notes.md
│
├── project-config/        # Proje kuralları ve standartlar
│   ├── workflow.md
│   ├── conventions.md
│   ├── tech-stack.md
│   └── agent-instructions.md
│
├── project-docs/          # Kalıcı hafıza ve changelog
│   ├── MEMORY.md
│   └── CHANGELOG.md
│
├── project-plans/         # Uygulama planları
│
├── CLAUDE.md              # Ana konfigürasyon (Claude Code bunu otomatik okur)
└── ...                    # Projenin kendi kod dizinleri
```

> **Adlandırma**: `project-` prefix'i yerine proje kısa adını kullan (ör: `myapp-tasks/`, `myapp-docs/`).

---

## 2. CLAUDE.md Template

Bu dosya proje kökünde olmalı. Claude Code her session'da otomatik okur.

````markdown
# [PROJE_ADI]

## Proje
[1-2 cümle proje açıklaması]

- **GitHub**: [repo URL]

## Slash Commandlar

| Command | Ne yapar |
|---------|----------|
| `/cold-start` | Session başlangıcı — projeyi oku, durumu raporla |
| `/git-full` | Stage, commit, push — task durumlarını güncelle |
| `/local-testing` | Tüm servisleri ayağa kaldır ve doğrula |
| `/turn-off` | Session notu yaz, taskları işaretle, push, kapat |

---

## Mevcut Durum

**Progress**: 0/[TOPLAM] task (%0) — Phase 0 başlıyor.

> Her yeni session'da `[PREFIX]-tasks/task-index.md` oku veya `/cold-start` çalıştır.

---

## Workspace

```
[Proje dizin yapısını buraya yaz — paketler, uygulamalar, portlar]
```

## Temel Komutlar

```bash
[Projeye özel build/dev/test/lint komutları]
```

---

## Code Conventions (Kısa)

[3-5 madde — TypeScript strict, dosya isimlendirme, API format, commit convention]

Detaylar → `[PREFIX]-config/conventions.md`

## Parallel Agent Orchestration

Birden fazla sub-agent paralel çalıştırılırken:
- Her agent sadece kendi modül dizininde dosya düzenler (dizin izolasyonu)
- Paket kurulumu sadece ana agent (orchestrator) tarafından yapılır
- Paylaşılan dosyalarda retry pattern uygulanır
- Bağımlı task'lar sıralı, bağımsız olanlar paralel çalıştırılır

Detaylar → `[PREFIX]-config/agent-instructions.md`

---

## Referans Dizinleri

| Dizin | İçerik |
|-------|--------|
| `[PREFIX]-tasks/` | Task takip — dashboard + tüm task'lar |
| `[PREFIX]-tasks/task-index.md` | Master task listesi |
| `[PREFIX]-tasks/phases/` | Phase bazlı detaylı task açıklamaları |
| `[PREFIX]-tasks/active/session-notes.md` | Session notları |
| `[PREFIX]-config/workflow.md` | Task workflow kuralları |
| `[PREFIX]-config/conventions.md` | Kod standartları |
| `[PREFIX]-config/tech-stack.md` | Teknolojiler + versiyonlar |
| `[PREFIX]-config/agent-instructions.md` | Sub-agent sorumlulukları |
| `[PREFIX]-docs/MEMORY.md` | Kalıcı hafıza |
| `[PREFIX]-docs/CHANGELOG.md` | Değişiklik kaydı |
| `[PREFIX]-plans/` | Uygulama planları |

---

## Hooks (Otomatik Kurallar)

| Hook | Tetikleyici | Ne yapar |
|------|------------|----------|
| `protect-files.sh` | PreToolUse (Edit/Write) | .env, lock files, .git/ düzenlemeyi bloklar |
| [Projeye özel hook'lar ekle] | | |

---

## Notlar

- Hafıza dosyası `[PREFIX]-docs/MEMORY.md`'de — her session'da oku, gerektiğinde güncelle
- [Projeye özel notlar]
````

---

## 3. Task Sistemi

### 3.1 Task Index Template (`[PREFIX]-tasks/task-index.md`)

````markdown
# [PROJE_ADI] - Task Index

## Dashboard

| Phase | Name | Total | Done | In Progress | Pending | Blocked |
|-------|------|-------|------|-------------|---------|---------|
| 0 | Project Setup | ? | 0 | 0 | ? | 0 |
| 1 | [Phase adı] | ? | 0 | 0 | ? | ? |
| ... | ... | ... | ... | ... | ... | ... |
| **Total** | | **?** | **0** | **0** | **?** | **?** |

**Progress**: 0/? (0%)

---

## Phase 0: Project Setup

| ID | Task | Agent | Complexity | Status | Dependencies |
|----|------|-------|-----------|--------|-------------|
| TASK-001 | Monorepo + tooling init | devops | S | PENDING | - |
| TASK-002 | Meta directories (tasks, plans, docs, config) | docs | S | PENDING | - |
| TASK-003 | .claude/ hooks, commands, settings | devops | M | PENDING | TASK-001 |
| TASK-004 | CLAUDE.md master configuration | docs | M | PENDING | TASK-002 |
| TASK-005 | Docker dev environment | devops | M | PENDING | TASK-001 |
| TASK-006 | Lint, format, TypeScript config | devops | S | PENDING | TASK-001 |
| TASK-007 | Git repo init + first commit | devops | S | PENDING | TASK-001..006 |

## Phase 1: [Core İsmi]

| ID | Task | Agent | Complexity | Status | Dependencies |
|----|------|-------|-----------|--------|-------------|
| TASK-008 | [İlk domain task] | [agent] | [S/M/L] | PENDING | TASK-007 |
| ... | ... | ... | ... | ... | ... |
````

### 3.2 Phase Dosyası Template (`[PREFIX]-tasks/phases/phase-X.md`)

````markdown
# Phase X: [Phase Adı]

## TASK-XXX: [Task Başlığı]

**Agent**: backend/frontend/database/devops/docs
**Complexity**: S (1-2 saat) / M (3-5 saat) / L (1+ gün)
**Status**: PENDING
**Dependencies**: TASK-YYY, TASK-ZZZ

### Açıklama
[Task'ın ne yaptığını anlat]

### Acceptance Criteria
- [ ] [Kriter 1]
- [ ] [Kriter 2]
- [ ] [Kriter 3]

### Notlar
[İpuçları, referanslar, dikkat edilecekler]
````

### 3.3 Task Durumları

```
PENDING → IN_PROGRESS → COMPLETED
                      → BLOCKED (bağımlılık bitmemiş)
```

### 3.4 Karmaşıklık Ölçeği

| Seviye | Anlam | Tipik Süre |
|--------|-------|------------|
| S (Small) | Tek dosya, basit değişiklik | 1-2 session turn |
| M (Medium) | Birkaç dosya, orta karmaşıklık | 3-5 turn |
| L (Large) | Çok dosya, mimari karar gerektirir | Tam bir session |

---

## 4. Slash Commands

### 4.1 Cold Start (`.claude/commands/cold-start.md`)

```markdown
Yeni bir session başlıyor. Projeyi tam olarak anlamak için aşağıdaki adımları sırasıyla uygula:

1. `CLAUDE.md` dosyasını oku — proje özeti, conventions, slash command referansları
2. `[PREFIX]-docs/MEMORY.md` oku — kalıcı hafıza, teknik kararlar, öğrenilen pattern'ler
3. `[PREFIX]-tasks/task-index.md` oku — dashboard + tüm task durumları
4. `[PREFIX]-tasks/active/session-notes.md` oku — önceki session notları
5. Aktif (IN_PROGRESS) task var mı kontrol et → varsa phase dosyasından detayını oku
6. Son birkaç git commit'i incele (`git log --oneline -10`)
7. Kısa bir durum raporu ver:
   - Toplam ilerleme (X/Y)
   - Hangi phase'de olduğumuz
   - Aktif task varsa hangisi
   - Sıradaki task(lar) ve bağımlılıkları
   - Önceki session'dan dikkat edilecek notlar (varsa)
8. "Hazırım, devam edebiliriz." mesajı ver

NOT: Kod değiştirme. Sadece oku ve rapor ver.
```

### 4.2 Git Full (`.claude/commands/git-full.md`)

```markdown
Tüm değişiklikleri stage, commit ve push et. Adımlar:

1. `git status` çalıştır — değişen dosyaları gör
2. `git diff --stat` çalıştır — değişiklik özetini gör
3. `[PREFIX]-tasks/task-index.md` oku — aktif/tamamlanmış task durumunu kontrol et
4. Eğer IN_PROGRESS task varsa ve işi bittiyse:
   - task-index.md'de durumunu COMPLETED yap
   - Dashboard tablosundaki sayıları güncelle
   - CHANGELOG'a kısa bir kayıt ekle
5. .env dosyalarının stage'lenmediğinden emin ol
6. Tüm ilgili dosyaları stage et (.env, credentials hariç)
7. Değişiklikleri analiz edip anlamlı bir commit mesajı yaz:
   - Task ile ilgiliyse: `feat(TASK-XXX): açıklama`
   - Genel ise: `chore/docs/fix: açıklama`
   - Co-Authored-By satırını ekle
8. `git push` ile push et
9. Son commit'leri göster ve kısa özet ver

NOT: .env, credentials veya secret içeren dosyaları ASLA commit etme.
```

### 4.3 Turn Off (`.claude/commands/turn-off.md`)

```markdown
Session'ı kapatmadan önce yapılması gerekenler:

1. **Mevcut durumu değerlendir**:
   - task-index.md oku — aktif task var mı?
   - Yapılan işleri listele

2. **Task durumlarını güncelle**:
   - Tamamlanan task'ları COMPLETED olarak işaretle
   - Yarım kalanları IN_PROGRESS bırak veya notla PENDING'e çevir
   - Dashboard tablosundaki sayıları güncelle

3. **Session notu yaz** — `[PREFIX]-tasks/active/session-notes.md`:
   - Tarih
   - Bu session'da yapılanlar (kısa maddeler)
   - Yarım kalan işler
   - Bir sonraki session'da yapılması gerekenler
   - Dikkat edilecek noktalar

4. **CLAUDE.md mevcut durum** bölümünü güncelle:
   - Progress sayısını güncelle
   - Sıradaki taskları güncelle

5. **Git full çalıştır** — tüm dosyaları stage et, commit et, push et

6. **Kapanış mesajı ver**:
   - Session özeti
   - Bir sonraki session'da yapılacaklar
   - "Session kapatıldı, tüm değişiklikler push edildi."
```

### 4.4 Local Testing (`.claude/commands/local-testing.md`)

```markdown
Local dev ortamını ayağa kaldır ve tüm servisleri doğrula:

0. **Port temizliği** (ÖNCELİKLİ):
   - Eski process'leri kontrol et ve temizle

1. **Altyapı servisleri**:
   - Docker/container durumunu kontrol et
   - Kapalıysa başlat, healthy olmasını bekle

2. **Veritabanı**:
   - ORM/migration client güncel mi?
   - Pending migration var mı?
   - Seed data var mı? Yoksa seed çalıştır

3. **Backend**:
   - Build kontrolü
   - Health endpoint testi

4. **Frontend**:
   - Build kontrolü
   - Derleme hatası varsa bildir

5. **Özet rapor ver**:
   - Her servisin durumu (OK/FAIL)
   - Erişim URL'leri
   - "Test ortamı hazır." veya bulunan hataları bildir

NOT: Sunucuları arka planda başlatma — sadece build ve health check yap.
```

---

## 5. Hooks Sistemi

### 5.1 Dosya Koruma (`.claude/hooks/protect-files.sh`)

```bash
#!/bin/bash
# PreToolUse hook: Hassas dosyaları Edit/Write'dan koru
# Exit 2 = BLOCK, Exit 0 = ALLOW

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

# .env dosyaları
if [[ "$FILE_PATH" =~ \.env($|\.local|\.production|\.staging|\.test|\.development) ]]; then
  echo "BLOCKED: .env files are protected." >&2
  exit 2
fi

# Lock dosyaları
if [[ "$FILE_PATH" == *"pnpm-lock.yaml"* ]] || [[ "$FILE_PATH" == *"package-lock.json"* ]] || [[ "$FILE_PATH" == *"yarn.lock"* ]]; then
  echo "BLOCKED: Lock files should only be modified by the package manager." >&2
  exit 2
fi

# .git dizini
if [[ "$FILE_PATH" == *"/.git/"* ]]; then
  echo "BLOCKED: .git directory should not be edited directly." >&2
  exit 2
fi

# Credentials
if [[ "$FILE_PATH" == *"credentials"* ]] || [[ "$FILE_PATH" == *"secrets"* ]] || [[ "$FILE_PATH" == *"service-account"* ]]; then
  echo "BLOCKED: Credential files are protected." >&2
  exit 2
fi

exit 0
```

### 5.2 Proje-Spesifik Hook Örnekleri

**ORM auto-generate** (schema değişince client yenile):
```bash
#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ "$FILE_PATH" == *"schema.prisma"* ]]; then
  cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0
  npx prisma generate 2>&1
fi
exit 0
```

**Plan auto-copy** (plan dosyasını proje dizinine kopyala):
```bash
#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ "$FILE_PATH" == *".claude/plans/"* ]]; then
  PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
  PLANS_DIR="$PROJECT_DIR/[PREFIX]-plans"
  mkdir -p "$PLANS_DIR"
  cp "$FILE_PATH" "$PLANS_DIR/$(basename "$FILE_PATH")" 2>/dev/null
fi
exit 0
```

---

## 6. Settings (`.claude/settings.local.json`)

```json
{
  "permissions": {
    "allow": [
      "Bash(ls:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git branch:*)",
      "Bash(docker compose:*)",
      "Bash(lsof:*)",
      "Bash(kill:*)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/protect-files.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "PostToolUse": []
  }
}
```

> **Not**: `permissions.allow` listesine projeye özel komutları ekle (pnpm, npm, npx, bun vb.)

---

## 7. Kalıcı Hafıza Sistemi

### 7.1 MEMORY.md Template (`[PREFIX]-docs/MEMORY.md`)

````markdown
# [PROJE_ADI] Project Memory

## Project Info
- [Projenin ne olduğu, 1 cümle]

## Project Status
- **Phase 0**: [durum] — [özet]
- **Phase 1**: [durum] — [özet]

## Key Technical Decisions
- [Karar 1: neden X seçildi, Y değil]
- [Karar 2: ...]

## Important Patterns
- [Pattern 1: dikkat edilecek teknik detay]
- [Pattern 2: ...]

## Known Issues / Gotchas
- [Gotcha 1: sorun + çözüm]
- [Gotcha 2: ...]

## Working Credentials (Dev)
- [Kullanıcı / şifre / rol — sadece dev seed]
````

### 7.2 Hafıza Kuralları

- Session başında MEMORY.md okunur
- Teknik karar alındığında, bug çözüldüğünde, gotcha keşfedildiğinde güncellenir
- Yanlış/eski bilgi silinir veya düzeltilir
- Kısa ve öz tutulur — roman değil, referans kartı

### 7.3 Claude User Memory Redirect

`~/.claude/projects/[PROJECT_HASH]/memory/MEMORY.md` dosyasına şu yazılır:

```markdown
# [PROJE_ADI] - Memory Redirect
Kalıcı hafıza dosyası proje klasörüne taşındı:
→ `/path/to/project/[PREFIX]-docs/MEMORY.md`
Her session'da o dosyayı oku ve güncelle.
```

Bu sayede hafıza dosyası git'e dahil olur ve session'lar arası taşınır.

---

## 8. Workflow Kuralları

### 8.1 Task Workflow (`[PREFIX]-config/workflow.md`)

````markdown
# Workflow Rules

## Pre-Task
1. Read `task-index.md` for project status
2. Read phase file for task details
3. Check all dependencies are COMPLETED
4. Update task status to IN_PROGRESS

## During Task
- Follow acceptance criteria strictly
- Run validation (typecheck + lint) after changes
- Keep changes focused on task scope

## Post-Task
1. Verify all acceptance criteria
2. Run validation commands
3. Update `task-index.md` (status + dashboard)
4. Update `CHANGELOG.md`
5. Git commit: `feat(TASK-XXX): title`
6. Check blocked tasks, unblock if ready

## Commit Conventions

```
feat(TASK-XXX): description     # New feature
fix(TASK-XXX): description      # Bug fix
refactor(TASK-XXX): description # Refactoring
docs(TASK-XXX): description     # Documentation
chore(TASK-XXX): description    # Tooling/config
test(TASK-XXX): description     # Tests
```

## Validation Commands

```bash
[Projeye özel typecheck, lint, test, build komutları]
```
````

---

## 9. Agent Orkestrasyon

### 9.1 Agent Tipleri (`[PREFIX]-config/agent-instructions.md`)

````markdown
# Agent Instructions

## Sub-Agent Types

### Backend Agent
- **Scope**: API modülleri, servisler, controller'lar, DTO'lar
- **Validation**: `typecheck && lint && test`
- **Commit Prefix**: `feat(api)`, `fix(api)`

### Frontend Agent
- **Scope**: Sayfalar, component'ler, hook'lar, store'lar
- **Validation**: `typecheck && lint`
- **Commit Prefix**: `feat(web)`, `fix(web)`

### Database Agent
- **Scope**: ORM schema, migration'lar, seed data
- **Validation**: `orm generate && orm migrate`
- **Commit Prefix**: `feat(db)`, `fix(db)`

### DevOps Agent
- **Scope**: Docker, CI/CD, config dosyaları
- **Commit Prefix**: `chore(docker)`, `chore(ci)`

### Docs Agent
- **Scope**: Dokümantasyon, changelog, planlar
- **Commit Prefix**: `docs(*)`

## Agent Rules
1. Task detaylarını oku, sonra başla
2. Kendi scope'un dışındaki dosyalara dokunma
3. Her değişiklikten sonra validation çalıştır
4. Task tracking güncelle
5. Commit'ler atomik ve açıklayıcı olsun
````

### 9.2 Paralel Orkestrasyon Kuralları

```
┌─────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR (Ana Agent)              │
│                                                         │
│  Öncesinde:                                             │
│  1. Paket kurulumlarını yap                             │
│  2. Gerekli dizinleri oluştur                           │
│  3. Bağımlılıkları kontrol et                           │
│  4. Agent'ları farklı dizinlere yönlendir               │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Agent A  │  │ Agent B  │  │ Agent C  │  ← Paralel   │
│  │ src/foo/ │  │ src/bar/ │  │ src/baz/ │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                         │
│  Sonrasında:                                            │
│  1. Paylaşılan dosyaları kontrol et                     │
│  2. Monorepo typecheck çalıştır                         │
│  3. Task tracking güncelle                              │
│  4. Çakışma raporu ver                                  │
└─────────────────────────────────────────────────────────┘
```

### 9.3 Dizin İzolasyonu

Her agent yalnızca kendine atanan dizinde dosya oluşturur/düzenler:

| Agent Task | İzin Verilen Dizin | Yasak |
|------------|-------------------|-------|
| [Modül A] | `src/module-a/` | Diğer `src/*/` |
| [Modül B] | `src/module-b/` | Diğer `src/*/` |
| [Sayfa X] | `pages/x/`, `components/x/` | Diğer sayfa dizinleri |

### 9.4 Paylaşılan Dosya Çakışma Yönetimi

Birden fazla agent'ın düzenleyebileceği dosyalar (ör: root module, navigation config):

1. Agent dosyayı `Read` ile okur
2. `Edit` ile düzenler
3. "File modified since read" hatası alırsa → tekrar okur → yeniden dener
4. Maksimum 3 retry
5. 3 retry sonra → durur, orchestrator'a bildirir

### 9.5 Sıralama

```
Bağımsız task'lar → paralel çalıştır (farklı dizinler)
Bağımlı task'lar  → sıralı çalıştır (blocker tamamlanınca başlat)
Paylaşılan dosya  → agent kendi içinde retry ile çözer
Paket kurulumu    → sadece orchestrator yapar
```

---

## 10. Session Notları Template

`[PREFIX]-tasks/active/session-notes.md`:

````markdown
# Session Notes

## [TARİH] — Session X

### Yapılanlar
- [x] TASK-XXX: [açıklama]
- [x] TASK-YYY: [açıklama]

### Yarım Kalan İşler
- [ ] TASK-ZZZ: [ne kaldı, nerede bırakıldı]

### Bir Sonraki Session
- [ ] [Yapılması gereken 1]
- [ ] [Yapılması gereken 2]

### Dikkat Edilecekler
- [Bug, workaround, karar bekleyen konu]
````

---

## 11. CHANGELOG Template

`[PREFIX]-docs/CHANGELOG.md`:

````markdown
# Changelog

## [TARİH]

### Added
- TASK-XXX: [eklenen özellik]

### Changed
- TASK-YYY: [değiştirilen şey]

### Fixed
- TASK-ZZZ: [düzeltilen bug]
````

---

## 12. Phase Planlama Rehberi

### Tipik Phase Yapısı

| Phase | İçerik | Bağımlılık |
|-------|--------|------------|
| **0** | Proje kurulumu, tooling, Docker, meta dizinler | - |
| **1** | Temel altyapı (DB, auth, API scaffold, frontend scaffold) | Phase 0 |
| **2** | İş mantığı (domain CRUD, temel iş kuralları) | Phase 1 |
| **3** | İleri özellikler (AI, entegrasyonlar, otomasyon) | Phase 2 |
| **4-5** | Ek kanallar (bot, WebSocket, notification) | Phase 2-3 |
| **6** | Frontend sayfaları (her backend modülün UI'ı) | Phase 2+ |
| **7** | Test & QA (unit, integration, E2E, load) | Phase 1+ |
| **8** | Deployment (Docker prod, CI/CD, monitoring) | Phase 7 |

### Task ID Şeması

- `TASK-001` ile `TASK-007`: Phase 0 (setup) — her projede benzer
- `TASK-008+`: Domain-spesifik task'lar
- Her phase'de 5-15 task hedefle
- Toplam 50-100 task arası ideal

### Bağımlılık Grafiği

```
TASK-001 (monorepo init)
  ├── TASK-003 (.claude setup)
  ├── TASK-005 (Docker)
  ├── TASK-006 (lint/format)
  └── TASK-007 (git init) ← tüm Phase 0'a bağımlı
       ├── TASK-008 (DB schema) → TASK-010 (seed)
       ├── TASK-009 (backend scaffold) → TASK-011 (auth)
       └── TASK-012 (frontend scaffold) → TASK-013 (frontend auth)
```

---

## 13. MCP Server Routing

Global MCP server'lar varsa, token tasarrufu için routing kuralı koy:

| MCP Server | Ne Zaman Kullan |
|------------|----------------|
| **context7** | Harici kütüphane/SDK API'si yazarken |
| **exa** | Güncel bilgi, bilinmeyen hatalar, araştırma |
| **repomix** | Repo-wide analiz, çoklu dosya refactor öncesi |

**Kural**: Basit kod düzenleme → hiçbirini çağırma, built-in araçlar yeterli.

---

## 14. Hızlı Başlangıç Checklist

Yeni proje başlatırken Claude Code'a bu listeyi ver:

- [ ] Git init + .gitignore
- [ ] Meta dizinleri oluştur (`[PREFIX]-tasks/`, `[PREFIX]-docs/`, `[PREFIX]-config/`, `[PREFIX]-plans/`)
- [ ] CLAUDE.md yaz (bu template'den)
- [ ] Task index oluştur (Phase 0 task'ları ile)
- [ ] Phase 0 detay dosyası oluştur
- [ ] Slash command'ları oluştur (4 adet)
- [ ] protect-files.sh hook'u oluştur + settings.local.json
- [ ] MEMORY.md oluştur
- [ ] CHANGELOG.md oluştur
- [ ] workflow.md oluştur
- [ ] conventions.md oluştur (projeye özel)
- [ ] agent-instructions.md oluştur (agent scope'ları ile)
- [ ] session-notes.md oluştur (boş template)
- [ ] İlk commit: `chore: project scaffold with Claude Code workflow`

---

## 15. Anti-Pattern'ler

| Yapma | Yap |
|-------|-----|
| Tüm task'ları tek phase'e koy | 5-8 phase'e böl, her biri 5-15 task |
| Task bağımlılıklarını atla | Her task'ın dependency'sini açıkça yaz |
| MEMORY.md'yi roman gibi yaz | Kısa bullet point'ler, referans kartı formatı |
| Agent'lara aynı dizini ver | Her agent'a farklı dizin ata (izolasyon) |
| Session notu yazmadan kapat | `/turn-off` ile kapatarak not bırak |
| Commit mesajını generic yaz | `feat(TASK-XXX): açıklama` formatı kullan |
| .env'yi commit et | Hook ile otomatik koru |
| Hafızayı güncellemeyi unut | Her gotcha/karar anında güncelle |
