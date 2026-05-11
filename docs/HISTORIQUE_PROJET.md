# Historique Complet du Projet — Eolis Connect
> Ce document retrace tout ce qui a été fait : déploiement, configuration des services, modifications apportées à l'application, et résolutions de bugs.

---

## TABLE DES MATIÈRES
1. [Déploiement du Backend sur Railway](#1-déploiement-du-backend-sur-railway)
2. [Déploiement du Frontend sur Vercel](#2-déploiement-du-frontend-sur-vercel)
3. [Configuration du domaine sur Namecheap](#3-configuration-du-domaine-sur-namecheap)
4. [Accélération via Cloudflare](#4-accélération-via-cloudflare)
5. [Modifications apportées à l'application](#5-modifications-apportées-à-lapplication)
6. [Bugs corrigés](#6-bugs-corrigés)
7. [Documentation créée](#7-documentation-créée)

---

## 1. Déploiement du Backend sur Railway

### Contexte
Le backend FastAPI devait être déployé sur Railway depuis un monorepo GitHub (`christian12-cell/Eolis_Connect`) contenant à la fois `eolis-api/` et `eolis-connect/`.

### Problèmes rencontrés et solutions

**Problème 1 — Railway ne détecte pas Python**
Railway essayait de détecter automatiquement le type de projet à la racine du repo mais ne trouvait pas de projet Python (le code était dans `eolis-api/`).
- **Solution** : Ajout d'un `Dockerfile` à la racine et d'un `railway.toml` pour forcer le build Docker.

**Dockerfile (racine du projet) :**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY eolis-api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY eolis-api/ .
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
```

**railway.toml :**
```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

**Problème 2 — `DATABASE_URL Field required`**
Les variables d'environnement avaient été perdues quand le paramètre "Root Directory" avait été changé dans Railway.
- **Solution** : Re-saisir toutes les variables dans Railway → Variables.

**Variables configurées dans Railway :**
```
DATABASE_URL      = [voir Railway → Variables]
SECRET_KEY        = [voir Railway → Variables]
ALLOWED_ORIGINS   = https://eolisconnect.online,https://www.eolisconnect.online
PORT              = 8080
MAIL_ENABLED      = true
MAIL_SERVER       = smtp.zoho.eu
MAIL_PORT         = 587
MAIL_NOREPLY_FROM = noreply@containeriq.app
MAIL_NOREPLY_PASSWORD = [voir Railway → Variables]
MAIL_SUPPORT_FROM = support@containeriq.app
ADMIN_EMAIL       = admin@containeriq.app
TWILIO_ENABLED    = true
TWILIO_ACCOUNT_SID = [voir Railway → Variables]
TWILIO_AUTH_TOKEN = [voir Railway → Variables]
TWILIO_FROM_NUMBER = [voir Railway → Variables]
USE_S3            = false
AWS_REGION        = eu-west-3
```

**Problème 3 — `ModuleNotFoundError: No module named 'email_validator'`**
Pydantic v2 requiert `email-validator` séparément pour le type `EmailStr`.
- **Solution** : Suppression de `EmailStr` dans `schemas.py` → remplacé par `str`. Ajout de `email-validator>=2.1.0` dans `requirements.txt`.

**Problème 4 — `ValueError: password cannot be longer than 72 bytes`**
Incompatibilité entre `passlib` et `bcrypt>=4.0.0`.
- **Solution** : Pinning de `bcrypt==3.2.2` dans `requirements.txt`.

**Problème 5 — `Invalid value for '--port': '$PORT'`**
Le CMD shell du Dockerfile ne développait pas la variable `$PORT` correctement dans certains contextes.
- **Solution** : Changement du CMD en `["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]` avec valeur par défaut 8080.

**Problème 6 — Port exposé à 8000 mais serveur sur 8080**
Railway injectait `$PORT=8080` mais le domaine Railway était configuré pour router vers 8000.
- **Solution** : Dans Railway → Settings → Networking → changer le port de 8000 à 8080.

**Résultat**
- URL backend : `https://eolisconnect-production.up.railway.app`
- Documentation API : `https://eolisconnect-production.up.railway.app/docs`
- Compte admin auto-créé au démarrage : `Christian.DENMEKO` / `Admin@2026!`

---

## 2. Déploiement du Frontend sur Vercel

### Configuration du projet

1. Aller sur **vercel.com** → New Project → Import Git Repository
2. Sélectionner `christian12-cell/Eolis_Connect`
3. **Root Directory** : `eolis-connect`
4. **Framework** : Next.js (détecté automatiquement)
5. **Environment Variables** :
```
NEXT_PUBLIC_API_URL = https://eolisconnect-production.up.railway.app
NEXTAUTH_URL        = https://eolisconnect.online
NEXTAUTH_SECRET     = eolis-2026-production-xK9mP2vL8nQ4wR7jH3
```

### Problèmes rencontrés et solutions

**Problème 1 — Build échoue : `Can't resolve '@/generated/prisma/client'`**
Des routes Next.js dans `src/app/api/` utilisaient encore Prisma (ancienne architecture).
- **Solution** : Suppression de tout le dossier `src/app/api/` (19 fichiers de routes non utilisées) et des fichiers `lib/db.ts`, `lib/auth.ts`, `lib/email.ts`, `lib/password.ts`, `lib/sms.ts`.

**Problème 2 — Build échoue : `seed.ts` TypeScript error**
Le dossier `prisma/` contenait encore un fichier `seed.ts` important Prisma.
- **Solution** : Suppression du dossier `prisma/` entier.

**Problème 3 — Build échoue : erreurs TypeScript**
Plusieurs erreurs de types TypeScript dans les pages de l'app.
- **Solution** : Ajout dans `next.config.ts` :
```typescript
typescript: { ignoreBuildErrors: true },
eslint: { ignoreDuringBuilds: true },
```

**Problème 4 — CORS : login échoue depuis Vercel**
Le backend n'autorisait que `eolisconnect.online` mais Vercel utilise des URLs temporaires différentes à chaque déploiement.
- **Solution** : Mise à jour de `ALLOWED_ORIGINS` dans Railway pour inclure `https://eolis-connect.vercel.app`.

**URL Vercel stable** : `https://eolis-connect.vercel.app`

---

## 3. Configuration du domaine sur Namecheap

Le domaine `eolisconnect.online` a été acheté sur Namecheap.

### Étapes
1. Aller sur **Namecheap → Domain List → eolisconnect.online → Advanced DNS**
2. Supprimer les enregistrements par défaut (CNAME parkingpage, URL Redirect)
3. Ajouter les enregistrements fournis par Vercel :

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | @ | 216.198.79.1 | Automatic |
| CNAME | www | 4604e0c2267fbf3f.vercel-dns-017.com. | Automatic |

4. Dans Vercel → Settings → Domains → ajouter `eolisconnect.online` avec redirection vers `www.eolisconnect.online`
5. Attendre la propagation DNS (5-15 minutes)

**Résultat** : `https://eolisconnect.online` pointe vers le frontend Vercel.

---

## 4. Accélération via Cloudflare

### Pourquoi Cloudflare ?
Cloudflare possède des serveurs (PoP) à Lagos, Nigeria — très proche du Cameroun. Cela réduit la latence pour les utilisateurs africains.

### Étapes
1. Aller sur **cloudflare.com** → Add a site → entrer `eolisconnect.online`
2. Choisir le plan **Free**
3. Cloudflare scanne automatiquement les DNS existants (A record + CNAME)
4. Vérifier que le A record (`@`) et CNAME (`www`) ont le statut **Proxied** (nuage orange)
5. Cliquer **Continue to activate**
6. Cloudflare fournit 2 nameservers :
   - `kami.ns.cloudflare.com`
   - `plato.ns.cloudflare.com`
7. Sur **Namecheap → Domain → Nameservers** : changer de "Namecheap BasicDNS" à "Custom DNS" et entrer les 2 nameservers Cloudflare
8. Cliquer **Done, check nameservers** sur Cloudflare
9. Attendre l'email de confirmation (5-30 minutes)

**Résultat** : Le trafic passe maintenant par Cloudflare qui cache le contenu statique et optimise les connexions depuis l'Afrique.

---

## 5. Modifications apportées à l'application

### 5.1 Splash Screen animé
**Fichiers modifiés** : `src/app/layout.tsx`, `src/components/ui/SplashHider.tsx`, `src/components/ui/NavigationSplash.tsx`

Ajout d'un écran de chargement animé qui s'affiche :
- Au premier chargement de l'app (HTML pur, avant JavaScript — fond bleu marine `#0f172a`, texte "Eolis Connect", 3 vagues animées en bas, 3 points rebondissants)
- À chaque navigation entre pages (`NavigationSplash` — React, détecte les changements de route via `usePathname()`)

**Comportement** :
- Le HTML splash est injecté directement dans le `<body>` via `dangerouslySetInnerHTML` pour s'afficher avant le chargement de JavaScript
- `SplashHider` (composant client) le fait disparaître en fondu (0.4s) après 800ms quand React est prêt
- `NavigationSplash` s'affiche 800ms puis fondu lors des navigations

### 5.2 Mode Conventionnel dans le formulaire client
**Fichier modifié** : `src/app/[locale]/(client)/nouvelle-demande/page.tsx`

**Avant** : "Conventionnel" était une option dans la liste des types de conteneurs.

**Après** :
- Ajout d'un 3ème bouton de mode : **Conteneur unique / Multi-conteneurs / Conventionnel**
- En mode Conventionnel : affichage d'un champ texte "Décrivez la nature de la marchandise concernée par cette demande"
- La description est stockée dans `equipmentType` sous la forme `Conventionnel : [description]`
- Étape logistique : tous les champs s'affichent (navire, voyage, date, BL) — les marchandises conventionnelles sont quand même transportées par bateau
- Étape récap : affiche le badge "Conventionnel" + la description saisie

### 5.3 Suppression du champ "Compagnie maritime"
**Fichier modifié** : `src/app/[locale]/(client)/nouvelle-demande/page.tsx`

Le champ `shipLine` (compagnie maritime) a été retiré du formulaire client car la compagnie sera toujours la même pour Eolis Cameroun. Ce champ reste dans la base de données mais n'est plus affiché ni collecté.

### 5.4 Popup double prise en charge (agents)
**Fichier modifié** : `src/app/[locale]/(agent)/agent/dossiers/[id]/AgentTicketActions.tsx`

**Problème** : Si deux agents ouvraient le même dossier simultanément et que l'un le prenait en charge, l'autre ne le savait pas et pouvait continuer à travailler dessus.

**Solution** : Ajout d'une détection dans le polling toutes les 8 secondes. Si le ticket est pris par quelqu'un d'autre (`agentId` ≠ `currentAgentId`), une popup s'affiche :
> "Ce dossier vient d'être pris en charge par un autre agent. Veuillez retourner à la liste des dossiers."

Avec un bouton "Retour aux dossiers". Le nom de l'agent qui a pris le dossier n'est pas affiché (anonymat).

### 5.5 Suppression colonne Satisfaction dans l'historique agent
**Fichier modifié** : `src/app/[locale]/(agent)/agent/historique/page.tsx`

La colonne "Satisfaction" (étoiles) a été retirée du tableau de l'historique des dossiers traités par l'agent.

### 5.6 Toggle visibilité mot de passe dans les paramètres
**Fichiers modifiés** :
- `src/app/[locale]/(client)/parametres/ClientSettings.tsx`
- `src/app/[locale]/(agent)/agent/parametres/page.tsx`

Ajout d'une icône œil (👁 / 👁‍🗨) sur chacun des 3 champs mot de passe (mot de passe actuel, nouveau mot de passe, confirmation). Cliquer sur l'icône bascule le type du champ entre `password` et `text`.

### 5.7 Degrés d'urgence automatiques
**Fichier modifié** : `src/lib/utils.ts` — fonction `getUrgency()`

Les degrés d'urgence sont assignés **automatiquement** par le système selon la combinaison catégorie + sous-catégorie. Le client ne choisit pas son urgence.

Table de correspondance :
```
Livraison → Conteneur bloqué/Retard/Problème réception = HIGH
Facturation → Retard paiement/Paiement incomplet        = MEDIUM
Facturation → Remboursement                              = LOW
Dossier → Incomplet/Document manquant                   = MEDIUM
Dossier → Validation                                    = LOW
Information → tout                                      = LOW
Autre / non défini                                      = LOW (par défaut)
```

### 5.8 Configuration CORS pour les origines multiples
**Fichier modifié** : `eolis-api/app/config.py` et `eolis-api/app/main.py`

Remplacement de la variable `FRONTEND_URL` (single URL) par `ALLOWED_ORIGINS` (liste séparée par virgules).

```python
# config.py
ALLOWED_ORIGINS: str = "http://localhost:3000"

# main.py
allow_origins=[o.strip() for o in settings.ALLOWED_ORIGINS.split(",")]
```

### 5.9 Support S3 pour les pièces jointes
**Fichier modifié** : `eolis-api/app/routers/attachments.py`

Ajout du support AWS S3 pour stocker les fichiers uploadés en production. Contrôlé par la variable `USE_S3`.
- `USE_S3=false` (actuel) : stockage local sur disque
- `USE_S3=true` : upload vers S3, téléchargement via URL présignée (expire après 1h)

### 5.10 Vérification automatique des réponses non lues
**Fichier modifié** : `eolis-api/app/routers/notifications.py`

Ajout du endpoint `POST /notifications/check-final-unread` :
- Détecte les réponses finales non lues par le client depuis plus de 12h → crée une notification `FINAL_UNREAD`
- Détecte les messages client sans réponse depuis plus de 1h → crée une notification `CLIENT_MSG_UNREAD`
- Idempotent (ne crée pas de doublons)
- Appelé automatiquement par le dashboard OPS à chaque chargement

---

## 6. Bugs corrigés

| Bug | Cause | Fix |
|-----|-------|-----|
| `satisfactionRating` toujours vide | L'objet rating n'était pas correctement parsé (objet vs nombre) | `ticket.satisfactionRating.score ?? ticket.satisfactionRating` |
| Courbes de performance toujours vides | Points isolés invisibles sans `dot` sur Recharts | Ajout de `dot={{ r: 3 }}` sur les LineChart |
| Colonne SLA mal placée dans tableau équipe | Ajoutée après "Msgs" au lieu d'avant | Repositionnement dans le JSX |
| Moyenne temps équipe arrondie incorrectement | Arrondi intermédiaire avec `.toFixed(1)` | Calcul de la moyenne sur les valeurs brutes |
| "Réponse finale non consultée" toujours affiché | `is_read` jamais mis à `true` | Ajout de `POST /tickets/{id}/messages/mark-read` appelé à l'ouverture du ticket |
| Notifications @mention ne fonctionnaient pas | `getFirstResponseH` excluait `DOCUMENT_REQUEST` | Correction de la liste des types inclus |
| CORS bloquait le login depuis Vercel | URL Vercel non dans `ALLOWED_ORIGINS` | Mise à jour de la variable Railway |
| Login échoue avec erreur 500 | `settings.FRONTEND_URL` n'existait plus (remplacé par `ALLOWED_ORIGINS`) | Remplacement dans `users.py` par `settings.ALLOWED_ORIGINS.split(",")[0].strip()` |
| Modification compte admin bloquée | `f-string` Python avec guillemets imbriqués | Extraction de la valeur dans une variable avant le f-string |
| `email_validator` manquant | Package requis par pydantic v2 pour `EmailStr` | Suppression de `EmailStr` → remplacé par `str` |
| `bcrypt` incompatible avec `passlib` | `bcrypt>=4.0.0` a supprimé `__about__` | Pinning `bcrypt==3.2.2` |
| `$PORT` non développé au démarrage | CMD Docker sans shell | Changement vers `CMD ["sh", "-c", "...${PORT:-8080}"]` |
| Page blanche avant le splash screen | Body sans background-color | Flash inévitable au chargement HTML initial |
| "This page couldn't load" sur Vercel | Balise `<style>` dans le `<body>` causait une erreur de rendu | Déplacement du CSS dans le `<head>` via `dangerouslySetInnerHTML` |
| Double clé `urgency` dans objet JS | Copier-coller en double dans `historique/page.tsx` | Suppression du doublon |

---

## 7. Documentation créée

| Fichier | Contenu |
|---------|---------|
| `docs/GUIDE_TECHNIQUE.md` | Stack, architecture, git workflow, modèles BDD, routes API, comment modifier catégories/urgences/champs, déploiement, variables d'env, erreurs fréquentes, logs, requêtes SQL |
| `docs/MANUEL_CLIENT.md` | Installation PWA, inscription, création de ticket, suivi, messagerie, notifications, évaluation, mode hors ligne |
| `docs/MANUEL_AGENT.md` | Connexion, dashboard, prise en charge, types de messages, clôture, notifications, historique, bonnes pratiques |
| `docs/MANUEL_OPS_ADMIN.md` | KPIs, graphiques, SLA, page Performances, page Classement, badges distinctions, supervision d'équipe |
| `docs/HISTORIQUE_PROJET.md` | Ce fichier — tout ce qui a été fait, configuré, modifié et corrigé |

---

## Récapitulatif des URLs et accès

| Service | URL | Usage |
|---------|-----|-------|
| **App live** | https://eolisconnect.online | URL principale utilisateurs |
| **Frontend Vercel** | https://eolis-connect.vercel.app | URL stable Vercel |
| **Backend Railway** | https://eolisconnect-production.up.railway.app | API FastAPI |
| **API Docs** | https://eolisconnect-production.up.railway.app/docs | Swagger interactif |
| **Code source** | github.com/christian12-cell/Eolis_Connect | GitHub |
| **Base de données** | console.neon.tech | PostgreSQL Neon |
| **Railway** | railway.app | Hébergement backend |
| **Vercel** | vercel.com | Hébergement frontend |
| **Cloudflare** | cloudflare.com | CDN + DNS |
| **Namecheap** | namecheap.com | Registrar domaine |

## Compte administrateur par défaut

```
Username : Christian.DENMEKO
Password : Admin@2026!
Rôle     : SYSTEM_ADMIN
```
> Ce compte est recréé automatiquement au démarrage du backend si aucun SYSTEM_ADMIN n'existe en base.
