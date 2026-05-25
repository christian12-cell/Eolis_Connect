# Eolis Connect — Décisions & Stratégie (session 24 mai 2026)

## Contexte
- **Présentation Debora (sœur de Christian)** : cette semaine
- **Présentation Christian** : Belgique, déploiement global 9 agences, 29 mai 2026 au Cameroun, devant le DG Guillaume Jozancy
- Prototype actuel : Cameroun uniquement

---

## 1. Les 9 agences Eolis dans le monde

| # | Pays | Devise | Zone |
|---|---|---|---|
| 1 | 🇨🇲 Cameroun | XAF (FCFA) | Afrique |
| 2 | 🇸🇳 Sénégal | XOF (FCFA) | Afrique |
| 3 | 🇨🇮 Côte d'Ivoire | XOF (FCFA) | Afrique |
| 4 | 🇬🇭 Ghana | GHS (Cedi) | Afrique |
| 5 | 🇲🇦 Maroc | MAD (Dirham) | Afrique |
| 6 | 🇫🇷 France | EUR | Europe |
| 7 | 🇧🇪 Belgique | EUR | Europe |
| 8 | 🇮🇹 Italie | EUR | Europe |
| 9 | 🇬🇧 Royaume-Uni | GBP | Europe |

> Cameroun + Sénégal + Côte d'Ivoire = tous FCFA (même valeur, XAF et XOF sont équivalents)

---

## 2. Coûts d'hébergement réels (mai 2026)

| Service | Rôle | USD | EUR | FCFA | Type |
|---|---|---|---|---|---|
| Railway | Backend API | ~$25 | ~23 € | ~15 000 | Fixe |
| Vercel | Frontend PWA | ~$20 | ~18 € | ~12 000 | Fixe |
| AWS S3 | Stockage fichiers | ~$5 | ~4,6 € | ~3 000 | Fixe |
| Resend | Emails transactionnels | ~$10 | ~9 € | ~6 000 | Fixe |
| Twilio Verify + numéros | OTP + n° UK | ~$1,30 | ~1,2 € | ~780 | Fixe |
| Twilio Programmable Messaging | SMS notifications | ~$33 | ~30 € | ~19 800 | Variable |
| OpenAI GPT-4o-mini | Extraction BL | ~$0,50–3 | variable | variable | Variable |
| OpenAI Whisper-1 | Transcription voice | ~$0,50–6 | variable | variable | Variable |

**Total observé mai 2026 : ~$95/mois · ~87 € · ~57 000 FCFA**

---

## 3. Coûts réels OpenAI

| Service | Modèle | Coût réel par action |
|---|---|---|
| Extraction IA (BL) | GPT-4o-mini | ~$0,0005 = ~0,3 FCFA |
| Transcription vocale | Whisper-1 | $0,006/min = ~3,6 FCFA/min |

---

## 4. Prix SMS par provider et par pays

### Twilio (actuel — trop cher pour l'Afrique)
| Pays | Prix/SMS | FCFA |
|---|---|---|
| 🇨🇲 Cameroun | $0,317 | 190 FCFA |
| 🇸🇳 Sénégal | $0,551 | 331 FCFA |
| 🇨🇮 Côte d'Ivoire | $0,440 | 264 FCFA |
| 🇬🇭 Ghana | ~$0,30 | ~180 FCFA |
| 🇲🇦 Maroc | $0,224 | 134 FCFA |
| 🇫🇷🇧🇪🇮🇹 Europe | $0,080 | 48 FCFA |
| 🇬🇧 UK | $0,080 | 48 FCFA |

### Seven.io (recommandé — moins cher partout)
| Pays | Prix/SMS | FCFA | Économie vs Twilio |
|---|---|---|---|
| 🇨🇲 Cameroun | $0,163 | 98 FCFA | −49% |
| 🇸🇳 Sénégal | $0,235 | 141 FCFA | −57% |
| 🇨🇮 Côte d'Ivoire | $0,288 | 173 FCFA | −35% |
| 🇬🇭 Ghana | $0,251 | 151 FCFA | −16% |
| 🇲🇦 Maroc | $0,115 | 69 FCFA | −49% |
| 🇫🇷🇧🇪🇮🇹 Europe | $0,075 | 45 FCFA | −6% |
| 🇬🇧 UK | $0,075 | 45 FCFA | −6% |

### Africa's Talking (Ghana + CIV uniquement)
- Couvre : Kenya, Uganda, Tanzania, Rwanda, Nigeria, **Côte d'Ivoire**, **Ghana**, Ethiopia, South Africa, Malawi, Zambia
- ❌ Ne couvre PAS : Cameroun, Sénégal, Maroc

---

## 5. Architecture SMS finale décidée

| Usage | Provider | Statut |
|---|---|---|
| SMS notifications (toutes agences) | **Seven.io** | Migration après démo |
| OTP / Verify | **Twilio Verify** (garder) | Ne pas changer |
| Emails | **Resend** (déjà en place) | Ne pas changer |
| SMS Europe (optionnel) | **Twilio** (garder) | Après déploiement global |

**Pour le prototype Cameroun :** Twilio reste en place, SMS réduits à 2 max par ticket (urgent + résolu uniquement).

---

## 6. Modèle crédits — logique finale

### Principe
- Crédits = **actifs demandés par l'utilisateur** (IA) + **SMS optionnel** (choix utilisateur)
- Email + Push = toujours gratuits
- SMS = optionnel, activable dans les paramètres, coûte des crédits

### Chiffres clés (code actuel)
```python
CREDITS_PER_EXTRACTION = 50.0       # ~0,3 FCFA coût réel → marge 99%
CREDITS_PER_VOICE_MINUTE = 10.0     # ~3,6 FCFA coût réel → marge 64%
CREDITS_INFO_PREMIUM_OPENING = 5.0  # ~0 FCFA coût réel → marge 100%
FREE_CREDITS_ON_SIGNUP = 100.0      # coût réel max ~34 FCFA pour Eolis
CREDITS_PER_SMS = 160.0             # À AJOUTER — basé sur Seven.io futur
```

### Prix d'achat des crédits par région (futur déploiement global)
| Région | 1 crédit = | Extraction (50c) | Voice/min (10c) | SMS (160c) |
|---|---|---|---|---|
| 🇨🇲🇸🇳🇨🇮 FCFA | 1 FCFA | 50 FCFA | 10 FCFA | 160 FCFA |
| 🇬🇭 Ghana | 1 GHS ≈ $0,07 | 50 GHS | 10 GHS | 160 GHS |
| 🇲🇦 Maroc | 1 MAD ≈ $0,10 | 50 MAD | 10 MAD | 160 MAD |
| 🇪🇺 Europe | €0,03 | 1,50 € | 0,30 € | 4,80 € |
| 🇬🇧 UK | £0,025 | 1,25 £ | 0,25 £ | 4,00 £ |
| 🇺🇸 USA | $0,03 | 1,50 $ | 0,30 $ | 4,80 $ |

### Logique SMS dans le code (à implémenter)
```
Événement ticket
├──→ Push notification     (toujours, gratuit)
├──→ Email                 (toujours, gratuit)
└──→ SMS ?
       ├── sms_notifications_enabled = false → rien
       ├── crédits < 160 → rien + notif "recharge"
       └── OK → Seven.io / Twilio → déduire 160 crédits
```

---

## 7. Subvention croisée Europe → Afrique

L'argument clé pour la présentation Belgique :
> Les clients européens (€/£) génèrent ~40× plus de revenus par crédit que les clients africains. Cette marge finance l'infrastructure africaine.

| Scénario | Revenus EU | Revenus Afrique | Coût infra | Résultat |
|---|---|---|---|---|
| 10 clients EU + 100 clients CM | ~500 € | ~7 500 FCFA | 57 000 FCFA | Équilibre |
| 50 clients EU + 500 clients CM | ~2 500 € | ~37 500 FCFA | 57 000 FCFA | Bénéfice |

---

## 8. Roadmap technique (dans l'ordre)

### Avant démo 29 mai (URGENT)
- [x] Score evolution graphe (fait)
- [x] Filtres performance/ranking (fait)
- [ ] **Réduire SMS à 2 par ticket max** (urgent + résolu seulement) dans `messages.py`
- [ ] Préparer données démo réalistes

### Après validation Guillaume
- [ ] Migrer Twilio Messaging → Seven.io
- [ ] Ajouter `sms_notifications_enabled` dans modèle User
- [ ] Ajouter `CREDITS_PER_SMS = 160` dans credit_service.py
- [ ] Toggle SMS dans paramètres utilisateur (frontend)
- [ ] Intégrer Stripe pour paiement EUR/GBP/USD
- [ ] Intégrer CinetPay/Monetbil pour Mobile Money FCFA

### Déploiement global (9 agences)
- [ ] Prix crédit par locale/pays dans la DB
- [ ] Affichage devise locale dans l'app
- [ ] Factures TVA pour clients européens
- [ ] Africa's Talking pour Ghana + Côte d'Ivoire

---

## 9. Speech Debora — version mise à jour (25 mai 2026)

### Chiffres clés à retenir (corrigés)

**Infrastructure fixe mensuelle (~66 $/mois = ~39 600 FCFA)**
| Service | $/mois | FCFA |
|---|---|---|
| Railway (backend) | $25 | ~15 000 |
| Vercel (frontend) | $20 | ~12 000 |
| AWS S3 | $5 | ~3 000 |
| Resend (emails) | $10 | ~6 000 |
| Twilio Verify (100 OTPs × $0,05 + $1 numéro) | $6 | ~3 600 |
| **Total fixe** | **$66** | **~39 600** |

> Les coûts OpenAI et SMS ne sont PAS dans l'infra — ils sont déjà déduits par ticket dans le modèle financier.

**Marges par type de dossier (1 BL + 1 min voix)**
| Type | Revenus | Coût réel | Marge | % |
|---|---|---|---|---|
| BL Premium | 60 FCFA | ~3,90 FCFA | ~56 FCFA | ~93% |
| Info Premium | 15 FCFA | ~3,60 FCFA | ~11,40 FCFA | ~76% |

**SMS optionnel (Seven.io — migration prévue après démo)**
- 160 FCFA facturés → 98 FCFA coût ($0,163 × 600) → **62 FCFA marge = 38,75%**
- Ne PAS dire "notre partenaire Seven.io" — dire "notre fournisseur SMS prévu"

**Seuil d'équilibre**
- BL seulement : ~707 dossiers/mois
- Info Premium seulement : ~3 474 dossiers/mois
- Mix 50/50 : ~1 175 dossiers/mois

- 100 crédits gratuits → coût réel Eolis : **~34 FCFA** (pas 100 FCFA)
- Bénéfice net = revenus recharges − coûts IA − coûts SMS − coûts infra

### Texte du speech

Nous avons aussi réfléchi à une question très importante :
comment faire pour que la plateforme puisse évoluer sur le long terme sans dépendre constamment des finances de l'entreprise ?

Donc dès le départ, nous avons intégré un véritable modèle économique dans Eolis Connect.

Le système fonctionne avec des crédits prépayés :
1 crédit = 1 FCFA.

Par exemple, sur un dossier standard :
- l'extraction intelligente d'un BL coûte 50 FCFA au client ;
- la dictée vocale environ 10 FCFA ;
- soit environ 60 FCFA générés par dossier de base.

Et pour les dossiers Info Premium — c'est-à-dire les demandes d'information directes —
chaque ouverture génère en plus 5 FCFA de marge pure, sans aucun coût associé côté traitement.

Pourtant, le coût réel du traitement derrière ces 60 FCFA est d'environ 4 FCFA seulement.
Ce qui laisse un bénéfice moyen d'environ 56 FCFA par dossier, avec une marge proche de 93 %.

À cela s'ajoute une fonctionnalité premium optionnelle : les notifications SMS.
Le client peut choisir d'activer les SMS sur son dossier.
Chaque SMS est facturé 160 crédits — soit 160 FCFA —
et grâce à notre partenaire Seven.io, le coût réel est d'environ 107 FCFA,
ce qui génère une marge de 53 FCFA supplémentaires par SMS envoyé, soit 33 % de marge additionnelle.

Donc concrètement, sur les usages IA seuls :
- 1 000 dossiers traités dans le mois représentent environ 56 000 FCFA de bénéfice ;
- 10 000 dossiers représentent environ 560 000 FCFA ;
- et 100 000 dossiers représentent environ 5 600 000 FCFA de bénéfice.

Et ça, uniquement sur une utilisation de base de la plateforme.

Notre infrastructure coûte environ 57 000 FCFA par mois.
Ce seuil est couvert dès environ 1 000 dossiers traités dans le mois.

Donc plus l'utilisation de la plateforme grandit, plus elle devient capable :
- de couvrir son hébergement ;
- ses mises à jour ;
- sa maintenance ;
- et son évolution dans le temps.

Et une fois ces charges couvertes, le surplus généré devient directement une valeur financière supplémentaire pour l'entreprise.

Et bien sûr, nous avons aussi pensé à toute la gestion de cette partie.
C'est pour cela qu'un espace financier dédié a été intégré directement dans Eolis Connect.

Cet espace permet de suivre en temps réel :
- les revenus des recharges clients ;
- les coûts réels de traitement IA et SMS, calculés automatiquement ;
- les coûts d'infrastructure saisis directement dans la plateforme ;
- et le bénéfice net, calculé automatiquement : revenus moins les coûts IA, moins les coûts SMS, moins les coûts infrastructure.

Les agents financiers ont ainsi une visibilité claire et immédiate sur la rentabilité globale de la plateforme, en temps réel.

---

## 10. Logs debug à supprimer après démo (Railway)

```python
# eolis-api/app/routers/ratings.py
print(f"[rating] ✅ Ticket {ticket.ref} — score={body.score}/5")

# eolis-api/app/routers/tickets.py
print(f"[tickets] {len(results)} tickets retournés — {rated} avec rating")
```
