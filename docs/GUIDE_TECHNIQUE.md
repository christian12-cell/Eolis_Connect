# Guide Technique — Eolis Connect

## 1. Vue d'ensemble du système

Eolis Connect est une plateforme web de gestion des demandes clients pour Eolis Cameroun. Elle est composée de deux applications distinctes qui communiquent entre elles.

```
[Utilisateur] → [eolisconnect.online] → [Cloudflare CDN]
                                              ↓
                                    [Vercel — Frontend Next.js]
                                              ↓
                              [Railway — Backend FastAPI + PostgreSQL Neon]
```

---

## 2. Les outils utilisés

### Frontend (ce que l'utilisateur voit)
| Outil | Rôle | Lien |
|-------|------|------|
| **Next.js 16** | Framework web React | vercel.com |
| **Tailwind CSS** | Design et mise en page | — |
| **Vercel** | Hébergement du frontend | vercel.com |
| **Cloudflare** | CDN (accélération mondiale) | cloudflare.com |

### Backend (le moteur invisible)
| Outil | Rôle | Lien |
|-------|------|------|
| **FastAPI** | API Python qui gère toute la logique | — |
| **PostgreSQL (Neon)** | Base de données cloud | console.neon.tech |
| **Railway** | Hébergement du backend | railway.app |
| **Twilio** | Envoi de SMS | twilio.com |
| **Zoho Mail** | Envoi d'emails | zoho.com |

### Code
| Outil | Rôle |
|-------|------|
| **GitHub** | Stockage du code source |
| **Git** | Versionnement du code |

---

## 3. Architecture détaillée

```
eolis-api/          ← Backend Python (FastAPI)
├── app/
│   ├── main.py         ← Point d'entrée, configuration CORS
│   ├── config.py       ← Variables d'environnement
│   ├── models.py       ← Structure de la base de données
│   ├── schemas.py      ← Validation des données
│   ├── security.py     ← JWT, mots de passe
│   └── routers/        ← Les routes API
│       ├── auth.py         → /api/auth/login, /register
│       ├── tickets.py      → /api/tickets
│       ├── messages.py     → /api/messages
│       ├── notifications.py → /api/notifications
│       ├── users.py        → /api/users
│       ├── ratings.py      → /api/ratings
│       ├── attachments.py  → /api/attachments
│       └── otp.py          → /api/otp

eolis-connect/      ← Frontend Next.js
├── src/
│   ├── app/
│   │   ├── [locale]/   ← Pages par langue (fr/en)
│   │   │   ├── (client)/   → Pages clients
│   │   │   ├── (agent)/    → Pages agents
│   │   │   └── (ops)/      → Pages OPS admins
│   ├── components/     ← Composants réutilisables
│   └── lib/
│       └── api-client.ts  ← Fonction apiFetch (appels API)
```

---

## 4. Variables d'environnement importantes

### Backend (Railway)
| Variable | Rôle |
|----------|------|
| `DATABASE_URL` | Connexion à la base de données Neon |
| `SECRET_KEY` | Clé de signature des tokens JWT |
| `ALLOWED_ORIGINS` | Domaines autorisés à appeler l'API |
| `MAIL_NOREPLY_PASSWORD` | Mot de passe email Zoho |
| `TWILIO_AUTH_TOKEN` | Clé Twilio pour les SMS |
| `USE_S3` | true/false — activer le stockage S3 |
| `PORT` | Port d'écoute (8080) |

### Frontend (Vercel)
| Variable | Rôle |
|----------|------|
| `NEXT_PUBLIC_API_URL` | URL du backend Railway |
| `NEXTAUTH_SECRET` | Clé de session (non utilisée activement) |

---

## 5. Comment déployer une modification

### Modifier le backend (eolis-api/)
```bash
# 1. Modifier les fichiers dans eolis-api/
# 2. Pousser sur GitHub
git add .
git commit -m "description de la modification"
git push

# 3. Aller sur Railway → Deployments → Deploy
```

### Modifier le frontend (eolis-connect/)
```bash
# 1. Modifier les fichiers dans eolis-connect/
# 2. Pousser sur GitHub
git add .
git commit -m "description de la modification"
git push

# 3. Vercel redéploie automatiquement (si connecté à GitHub)
# Sinon : Vercel → Deployments → Redeploy
```

---

## 6. Erreurs fréquentes et solutions

### ❌ "DATABASE_URL Field required"
**Cause :** Les variables d'environnement sont manquantes dans Railway.
**Solution :** Railway → Variables → ajouter toutes les variables listées dans `.env.example`.

### ❌ "Error: Invalid value for '--port': '$PORT'"
**Cause :** Railway n'injecte pas la variable PORT.
**Solution :** Ajouter `PORT=8080` dans Railway → Variables.

### ❌ "ModuleNotFoundError: No module named 'email_validator'"
**Cause :** Package Python manquant.
**Solution :** Ajouter `email-validator>=2.1.0` dans `eolis-api/requirements.txt` et redéployer.

### ❌ "CORS error" dans la console navigateur
**Cause :** L'URL du frontend n'est pas dans `ALLOWED_ORIGINS`.
**Solution :** Railway → Variables → `ALLOWED_ORIGINS` → ajouter l'URL manquante.

### ❌ Build Vercel échoue avec TypeScript error
**Cause :** Erreur de type dans le code.
**Solution :** Vérifier que `next.config.ts` contient `typescript: { ignoreBuildErrors: true }`.

### ❌ Le backend ne démarre pas (Railway)
**Solution :**
1. Railway → ton service → Deploy Logs → lire l'erreur
2. Si c'est une variable manquante → l'ajouter dans Variables
3. Si c'est un package manquant → l'ajouter dans `requirements.txt`

### ❌ Le frontend affiche une page blanche
**Solution :**
1. Ouvrir F12 → Console → lire l'erreur rouge
2. Si "Failed to fetch" → le backend Railway est down → le redémarrer
3. Si erreur JavaScript → vérifier les logs Vercel → Functions

---

## 7. Comment accéder aux logs

### Backend (Railway)
1. railway.app → ton projet → service `supportive-beauty`
2. Onglet **Deploy Logs** → logs de démarrage
3. Onglet **HTTP Logs** → toutes les requêtes reçues

### Frontend (Vercel)
1. vercel.com → projet `eolis-connect`
2. Onglet **Deployments** → cliquer le dernier déploiement
3. **Build Logs** → erreurs de compilation
4. **Functions** → erreurs côté serveur

### Base de données (Neon)
1. console.neon.tech → ton projet
2. Onglet **Tables** → voir les données
3. Onglet **SQL Editor** → exécuter des requêtes SQL

---

## 8. Comment accéder à la base de données

URL de connexion : dans Railway → Variables → `DATABASE_URL`

Depuis Neon Console :
```sql
-- Voir tous les utilisateurs
SELECT id, username, email, role, status FROM users;

-- Voir tous les tickets
SELECT id, ref, status, urgency, created_at FROM tickets ORDER BY created_at DESC;

-- Réinitialiser le mot de passe d'un utilisateur
UPDATE users SET password_hash = '...' WHERE username = 'Christian.DENMEKO';
```

---

## 9. Documentation API (Swagger)

L'API est documentée automatiquement :
- **URL :** `https://eolisconnect-production.up.railway.app/docs`
- Permet de tester tous les endpoints directement depuis le navigateur
- Utile pour déboguer sans avoir le frontend

---

## 10. Contacts et accès importants

| Service | URL | Accès |
|---------|-----|-------|
| GitHub | github.com/christian12-cell/Eolis_Connect | Code source |
| Railway | railway.app | Backend |
| Vercel | vercel.com | Frontend |
| Neon | console.neon.tech | Base de données |
| Cloudflare | cloudflare.com | CDN / DNS |
| Namecheap | namecheap.com | Domaine |
| Zoho | zoho.com | Emails |
| Twilio | twilio.com | SMS |
