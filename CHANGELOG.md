# Changelog — Eolis Connect

Toutes les modifications notables du projet sont documentées ici.  
Format : `[Date] — Type — Description`

---

## [2026-05-13] — Session BL upload, auth & session tracking

### Frontend — `eolis-connect`

#### Mode BL Upload (`nouvelle-demande/page.tsx`)
- **Nouveau step `'pick'`** : avant l'upload, le client voit ses Booking Confirmations déjà uploadés dans le système. S'il sélectionne un BL existant → pré-remplissage instantané sans appel GPT (économie de coûts). S'il veut un nouveau BL → flow upload/scan normal.
- **Wording** : *"Votre demande est-elle liée à l'un de vos Booking ?"*
- **Fix scanner dans step `upload`** : le `ScannerModal` n'était jamais rendu car le BL flow utilisait des `return` anticipés. Ajout du modal directement dans chaque return concerné.
- **Fix scanner dans step `describe`** : même correction appliquée.
- **Fix input file upload** (steps `upload` et `describe`) : remplacement de `className="sr-only"` par `absolute inset-0 opacity-0 w-full h-full` pour une compatibilité cross-platform (iOS, Android, PWA, web). Ajout du reset `e.target.value = ''` pour permettre la re-sélection du même fichier.
- **Refactor `buildBlFieldsFromRaw()`** : logique de conversion snake_case → camelCase extraite en fonction partagée, utilisée à la fois par l'extraction GPT et la réutilisation d'un BL précédent.

#### Dossier client — Blocs GPT non affichés (`mes-demandes/[id]/page.tsx`)
- **Fix mismatch de clés** : `blData` était accédé en snake_case (`booking_items`, `turn_in`, `port_of_loading`, `customer_ref`, `place_of_receipt`…) mais `blFields` est stocké en camelCase. Toutes les clés corrigées :
  - `booking_items` → `bookingItems`
  - `turn_in` → `turnIn`
  - `port_of_loading` → `portOfLoading`
  - `port_of_discharge` → `portOfDischarge`
  - `customer_ref` → `customerRef`
  - `place_of_receipt` → `placeOfReceipt`
  - `place_of_delivery` → `placeOfDelivery`
  - `pickup.size_type` → `pickup.sizeType`
  - `pickup.container_usage` → `pickup.containerUsage`
  - `pickup.release_date` → `pickup.releaseDate`
  - `turnIn.*_closing` → camelCase
  - items : `no_of_packs`, `kind_of_pack`, `description_of_goods`… → camelCase
  - `container_details` → `containerDetails` + sous-champs

#### Authentification & Sessions (`api-client.ts`, `MobileLayout.tsx`, `DashboardLayout.tsx`)
- **sessionStorage session marker** : `getUser()` retourne `null` si `sessionStorage.eolis_session` est absent. Ce marker est posé à chaque `saveSession()` (login) et effacé à `clearSession()` (logout). Résultat : quand l'OS mobile tue le process (libération RAM, fermeture app), le client doit se re-authentifier à la prochaine ouverture — même si le JWT de 4h n'est pas encore expiré.
- **401 auto-logout** : `apiFetch` détecte les réponses 401 → `clearSession()` + redirect `/login` automatique.
- **Check périodique 60s** : `MobileLayout` et `DashboardLayout` vérifient toutes les minutes si le token est expiré (`isTokenExpired()`) et déconnectent si besoin.

#### Service Worker (`public/sw.js`)
- Version passée de `eolis-v2` à `eolis-v3`.
- **Précache du shell** à l'installation : `/`, `/fr/accueil`, `/en/accueil`.
- **Fallback navigation** : en cas d'échec réseau sur une page jamais mise en cache (ex. nouveau dossier après création BL), retour sur le shell `/` au lieu de `503 "Offline"`. Corrige l'erreur *"This page couldn't load"* sur les navigations vers de nouveaux tickets.

#### Utilitaires (`utils.ts`)
- `normalizeDate()`, `formatDate()`, `timeAgo()` rendus défensifs : acceptent `null | undefined` sans crasher.

#### DashboardLayout (`DashboardLayout.tsx`)
- Prop `userName` rendue optionnelle (valeur par défaut `''`).
- Ajout du check de session périodique (même que MobileLayout).

#### Page Sessions Admin (`admin/sessions/page.tsx`)
- Fix crash potentiel : `s.firstName?.[0] ?? '?'` au lieu de `s.firstName[0]`.

---

### Backend — `eolis-api`

#### Tokens JWT (`security.py`, `routers/auth.py`)
- **Expiry par rôle** :
  - `CLIENT` → 4 heures
  - `AGENT`, `OPS_ADMIN`, `SYSTEM_ADMIN` → 7 heures
- `create_access_token(data, role)` : paramètre `role` ajouté pour déterminer la durée.
- Login (`auth.py`) : passage du `user.role` à `create_access_token`.

#### Router BL (`routers/bl.py`)
- **Nouveau endpoint `GET /api/bl/{bl_id}/raw`** : retourne le `raw_extracted` (JSON GPT snake_case) d'un BL appartenant au client. Utilisé par le frontend pour pré-remplir `blFields` sans nouvel appel GPT.

#### Router Sessions (`routers/sessions.py`)
- Fix ORDER BY sur colonne nullable : `.order_by(User.last_active_at.desc().nullslast())` → `text("last_active_at DESC NULLS LAST")` (compatibilité PostgreSQL/Neon).

---

## Prochaines étapes prévues
- [ ] Mode offline pour le BL upload (scan/upload sans réseau, sync à la reconnexion)
- [ ] OPS : dashboard enrichi (filtres avancés, stats par agent)
- [ ] SYSTEM ADMIN : redesign dashboard
- [ ] SMS auto après 1h si réponse finale non lue (APScheduler côté backend)
- [ ] OTP SMS Twilio : investiguer non-réception
