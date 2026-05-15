# Idée Feature : Micro / Speech-to-Text Premium

## Contexte du projet
Eolis Connect est une PWA de gestion de dossiers logistiques pour Eolis Cameroun.
Stack : Next.js 16 (frontend Vercel) + FastAPI Python (backend Railway) + PostgreSQL + AWS S3.
Le projet utilise déjà OpenAI (GPT-4o-mini pour extraction BL) — même clé API pour Whisper.

## L'idée

Ajouter un bouton microphone 🎙️ côté **client uniquement** à deux endroits :

### 1. Dans la description du formulaire "Nouvelle demande"
- Le client clique sur le micro pendant qu'il remplit sa demande
- Il parle, Whisper transcrit en temps réel
- Le texte s'affiche dans le bloc "Description"
- Il relit, corrige si besoin, puis continue normalement

### 2. Dans le chat (mes-demandes/[id])
- Le client clique sur le micro dans la zone de saisie du message
- Il parle, Whisper transcrit
- Le texte remplit la zone de message
- Il peut corriger avant d'envoyer

**Côté agent** : pas de micro, pas nécessaire.

## Technologie choisie : OpenAI Whisper

Choix délibéré (pas Web Speech API) car :
- Meilleure précision sur les accents africains / français camerounais
- Supporte ~100 langues dont FR, EN, et langues locales
- Même clé OpenAI déjà utilisée pour l'extraction BL
- Cohérence de facturation dans le tableau de bord coûts IA

**Tarif Whisper** : $0.006 par minute d'audio

## Popup "Fonctionnalités Premium" à redesigner

La popup actuelle (simple avertissement avant le mode BL) doit être remplacée par une vraie page détaillée qui s'affiche :
- Avant d'entrer en mode BL (extraction document)
- Avant d'utiliser le micro pour la première fois
- Si "Ne plus afficher" coché → plus jamais (localStorage: `eolis_premium_accepted`)

### Structure de la nouvelle popup

```
⚡ Fonctionnalités Premium

Ces fonctionnalités utilisent l'IA OpenAI et génèrent un coût facturable.

┌─────────────────────────────────────────────────┐
│ 📄 Analyse automatique de document              │
│    Technologie : GPT-4o-mini                    │
│    Coût : ~0.30 FCFA par extraction             │
│    → Lit et structure votre BL automatiquement  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 🎙️ Dictée vocale → Texte                       │
│    Technologie : Whisper (OpenAI)               │
│    Coût : ~3.60 FCFA par minute d'audio         │
│    → Parlez, le texte s'écrit automatiquement   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Estimation par dossier typique                 │
│  1 extraction BL          ≈   0.30 FCFA         │
│  2 min de dictée          ≈   7.20 FCFA         │
│  ─────────────────────────────────────────────  │
│  Total estimé             ≈   7.50 FCFA         │
│  (taux : 1$ = 600 FCFA — modifiable par admin)  │
└─────────────────────────────────────────────────┘

☐ Ne plus afficher ce message

[Annuler]    [J'ai compris, continuer →]
```

### Notes
- Le taux FCFA/$ vient de `SystemConfig` en DB (déjà modifiable par l'admin)
- L'estimation est indicative
- Le vrai coût réel est tracké dans `ai_usage` et visible dans /depenses

## Ce qui existe déjà (ne pas recréer)

- `AIUsage` model en DB (tracks tokens, cost_usd, cost_fcfa, fcfa_rate)
- `SystemConfig` pour le taux FCFA (clé "fcfa_rate")
- Page admin `/admin/ia-couts` — il faudra y ajouter les stats Whisper
- Page client `/depenses` — affiche les coûts par extraction, ajouter les transcriptions
- Popup actuelle dans `eolis-connect/src/app/[locale]/(client)/nouvelle-demande/page.tsx`
  - `showCostPopup` state, `eolis_bl_cost_accepted` localStorage

## Ce qu'il faut implémenter

### Backend
1. Nouveau endpoint `POST /api/whisper/transcribe`
   - Reçoit un fichier audio (webm/mp4/wav)
   - Appelle `openai.audio.transcriptions.create(model="whisper-1", file=...)`
   - Crée un `AIUsage` record (cost = durée × $0.006/60)
   - Retourne `{ text: "...", cost_fcfa: ..., duration_seconds: ... }`

2. Ajouter `type` à `AIUsage` pour distinguer "bl_extraction" vs "voice_transcription"
   (ou utiliser le champ `model` = "whisper-1" comme discriminant)

### Frontend
1. Redesigner la popup premium (`showCostPopup` dans nouvelle-demande)
   → Nouvelle version avec les deux features + estimation

2. Ajouter composant `VoiceRecorder` :
   - Bouton micro 🎙️
   - Utilise `MediaRecorder` API pour capturer l'audio
   - Envoie au backend `/api/whisper/transcribe`
   - En attendant : animation d'enregistrement (point rouge qui pulse)
   - Résultat : texte injecté dans le champ cible

3. Intégrer `VoiceRecorder` dans :
   - `nouvelle-demande/page.tsx` → champ description
   - `mes-demandes/[id]/page.tsx` → zone message du chat

4. Popup premium avant premier usage du micro (même logique que BL)

## Whisper pricing (pour référence)
- Modèle : `whisper-1`
- Tarif : $0.006 / minute
- 30 secondes → $0.003 ≈ 1.8 FCFA
- 1 minute → $0.006 ≈ 3.6 FCFA
- 2 minutes → $0.012 ≈ 7.2 FCFA
- Facturation minimum : par seconde arrondie
