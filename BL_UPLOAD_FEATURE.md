# Fonctionnalité : Upload & Extraction automatique de BL

> **Statut** : Idée validée — en attente d'exemples de BL de différentes compagnies maritimes avant implémentation.

---

## Vue d'ensemble

Ajouter un **4ème mode** dans le formulaire "Nouvelle demande" : **Upload BL / Booking Confirmation**.

L'utilisateur téléverse son document BL (PDF ou image). GPT-4 Vision extrait automatiquement tous les champs maritimes (compagnie, navire, voyage, date, etc.) et pré-remplit le formulaire. Les BL analysés sont ensuite mis en cache par client pour une réutilisation offline.

---

## Flux complet

### 1. Sélection du mode
Dans `/nouvelle-demande`, le sélecteur de mode aura un 4ème bouton :
```
[ Maritime ] [ Conventionnel ] [ Équipement ] [ 📄 Upload BL ]
```

### 2. Upload du fichier
- L'utilisateur uploade un PDF ou une image (photo de BL)
- Formats acceptés : `application/pdf`, `image/jpeg`, `image/png`
- Taille max recommandée : 10 MB

### 3. Extraction GPT-4 Vision (en ligne)
- Le frontend envoie le fichier au backend : `POST /api/bl/extract`
- Le backend envoie le document à GPT-4 Vision avec un prompt structuré
- GPT retourne un JSON avec les champs extraits
- Les champs sont automatiquement injectés dans le formulaire

**Champs extraits :**
| Champ BL | Champ formulaire |
|---|---|
| Shipping Line / Carrier | `ship_line` |
| Vessel Name | `ship_name` |
| Voyage Number | `voyage_number` |
| ETD / Date de départ | `ship_date` |
| B/L Number | `code` |
| Port of Loading | dans `vessel_data` |
| Port of Discharge | dans `vessel_data` |
| Shipper / Consignee | dans `vessel_data` |
| Container Numbers | dans `vessel_data` |
| Description of goods | dans `description` (base) |

### 4. Comportement en arrière-plan
- Si l'utilisateur **quitte la page pendant l'extraction** → le traitement continue en background
- Quand l'extraction est terminée → **notification in-app** : "Votre BL a été analysé, cliquez pour continuer"
- La notification redirige vers le formulaire pré-rempli (données stockées temporairement en localStorage/sessionStorage)

### 5. Mise en cache des BL par client
- Chaque BL analysé est sauvegardé dans la table `bl_documents` (voir schéma DB ci-dessous)
- Au prochain accès au formulaire, une liste déroulante "Mes BL récents" apparaît
- L'utilisateur peut sélectionner un BL déjà analysé → formulaire pré-rempli instantanément
- Les BL récents sont aussi mis en cache dans **IndexedDB** pour un accès offline

---

## Gestion offline

### Cas 1 : Première utilisation, pas de cache
→ Message : *"L'analyse de BL nécessite une connexion internet. Veuillez vous connecter pour utiliser cette fonctionnalité."*

### Cas 2 : BL déjà analysés en cache (IndexedDB)
→ La liste des BL récents s'affiche normalement
→ L'utilisateur peut sélectionner un BL existant et pré-remplir le formulaire
→ La création de la demande peut continuer en mode offline (draft local)

### Cas 3 : Upload tenté hors ligne
→ Message : *"Impossible d'analyser le document sans connexion. Votre fichier sera analysé automatiquement dès que vous serez en ligne."*
→ Le fichier est mis en file d'attente dans IndexedDB
→ Quand la connexion revient → upload + extraction automatique → notification

---

## Architecture technique

### Backend

#### Nouveau endpoint
```
POST /api/bl/extract
Content-Type: multipart/form-data
Body: file (PDF ou image)
Auth: Bearer token (CLIENT uniquement)
```

**Réponse :**
```json
{
  "bl_id": "uuid",
  "ship_line": "CMA CGM",
  "ship_name": "CMA CGM TAGE",
  "voyage_number": "0TXDE1MA",
  "ship_date": "2025-05-15",
  "code": "CMDUEA263476700",
  "vessel_data": "Port chargement: Douala / Port déchargement: Le Havre / Conteneurs: CMAU1234567 ...",
  "raw_text": "...",
  "confidence": 0.94
}
```

#### Nouvelle table DB : `bl_documents`
```sql
CREATE TABLE bl_documents (
    id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id   VARCHAR NOT NULL REFERENCES users(id),
    filename    VARCHAR,
    ship_line   VARCHAR,
    ship_name   VARCHAR,
    voyage_number VARCHAR,
    ship_date   VARCHAR,
    code        VARCHAR,          -- numéro BL
    vessel_data TEXT,
    raw_text    TEXT,
    confidence  FLOAT,
    created_at  TIMESTAMP DEFAULT NOW()
);
```

#### Modèle SQLAlchemy (`models.py`)
```python
class BLDocument(Base):
    __tablename__ = "bl_documents"
    id            = Column(String, primary_key=True, default=lambda: str(uuid4()))
    client_id     = Column(String, ForeignKey("users.id"), nullable=False)
    filename      = Column(String)
    ship_line     = Column(String)
    ship_name     = Column(String)
    voyage_number = Column(String)
    ship_date     = Column(String)
    code          = Column(String)
    vessel_data   = Column(Text)
    raw_text      = Column(Text)
    confidence    = Column(Float)
    created_at    = Column(DateTime, default=datetime.utcnow)
```

#### Router : `routers/bl.py`
- `POST /bl/extract` — upload + extraction GPT
- `GET /bl/my-bls` — liste des BL du client connecté (pour le dropdown)
- `GET /bl/{bl_id}` — récupérer un BL spécifique

#### Prompt GPT-4 Vision (base)
```
Tu es un expert en documents maritimes. Analyse ce document BL (Bill of Lading) 
ou Booking Confirmation et extrait les informations suivantes en JSON strict :
{
  "ship_line": "nom de la compagnie maritime",
  "ship_name": "nom du navire",
  "voyage_number": "numéro de voyage",
  "ship_date": "date ETD au format YYYY-MM-DD",
  "code": "numéro BL ou booking ref",
  "port_loading": "port de chargement",
  "port_discharge": "port de déchargement",
  "shipper": "expéditeur",
  "consignee": "destinataire",
  "containers": "liste des numéros de conteneurs séparés par virgule",
  "goods_description": "description des marchandises"
}
Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire.
Si un champ est absent du document, mets null.
```

> **Note :** Le prompt devra être affiné avec des exemples réels de BL de différentes compagnies (MSC, CMA CGM, Maersk, Evergreen, ICTSI, etc.) pour gérer les variations de format.

### Frontend

#### Composant `BLUploadMode.tsx`
```
eolis-connect/src/components/nouvelle-demande/BLUploadMode.tsx
```

**États possibles :**
1. `idle` — zone de drop / bouton upload
2. `uploading` — spinner "Envoi du document..."
3. `extracting` — spinner "Analyse en cours par IA..."
4. `success` — champs pré-remplis, résumé affiché, bouton "Modifier"
5. `error` — message d'erreur + bouton réessayer
6. `offline_first_use` — message "connexion requise"
7. `offline_cached` — dropdown des BL mis en cache

#### Cache IndexedDB (store `bl_cache`)
```typescript
interface CachedBL {
  id: string
  clientId: string
  filename: string
  shipLine: string
  shipName: string
  voyageNumber: string
  shipDate: string
  code: string
  vesselData: string
  cachedAt: number // timestamp
}
```

#### Notification de fin d'extraction (background)
- Stockage temporaire dans `localStorage` : `eolis_pending_bl`
- Format : `{ formData: {...}, extractedAt: timestamp }`
- Quand notification cliquée → redirection vers `/nouvelle-demande?bl_resume=1`
- Le formulaire lit `eolis_pending_bl` et pré-remplit automatiquement

---

## UX / Design

### Indicateur de confiance
Afficher un badge selon le score de confiance GPT :
- `>= 0.9` → badge vert "Haute confiance"
- `0.7 - 0.9` → badge orange "Vérifiez les champs"
- `< 0.7` → badge rouge "Vérification requise"

### Champs éditables
Tous les champs pré-remplis doivent rester éditables — l'utilisateur peut corriger les erreurs d'extraction avant de soumettre.

### Dropdown "BL récents"
```
┌─────────────────────────────────────────┐
│ 📄 Sélectionner un BL récent            │
├─────────────────────────────────────────┤
│ CMA CGM TAGE — VGE0TX — 12/05/2025     │
│ MSC DIANA — FP425R — 03/04/2025        │
│ Maersk Sealand — 245W — 18/03/2025     │
└─────────────────────────────────────────┘
```

---

## Étapes d'implémentation

- [ ] **0. Collecter des exemples BL** — MSC, CMA CGM, Maersk, Evergreen, ICTSI Cameroun, autres
- [ ] **1. Affiner le prompt GPT** avec les exemples réels
- [ ] **2. Backend** — table `bl_documents` + migration Neon + router `bl.py`
- [ ] **3. Frontend** — composant `BLUploadMode.tsx` + états online/offline
- [ ] **4. Cache IndexedDB** — store `bl_cache` + sync automatique
- [ ] **5. Background extraction** — localStorage pending + notification
- [ ] **6. Intégration formulaire** — injection des champs dans `FormState`
- [ ] **7. Tests** — tester avec BL de chaque compagnie collectée

---

## Variables d'environnement à ajouter

```env
# Railway (backend)
OPENAI_API_KEY=sk-...

# Optionnel : modèle à utiliser
OPENAI_MODEL=gpt-4o   # gpt-4o supporte la vision et est moins cher que gpt-4-vision-preview
```

---

## Dépendances à ajouter

**Backend (`requirements.txt`) :**
```
openai>=1.0.0
python-multipart  # déjà présent probablement
```

**Frontend (`package.json`) :**
- Rien de nouveau — l'IndexedDB est natif, fetch est natif

---

*Dernière mise à jour : 2026-05-12*
