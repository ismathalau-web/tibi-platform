# Tibi Retail Platform — Handoff pour la prochaine conversation

**Date** : 2026-04-19

---

## État actuel

### ✅ Ce qui est fait

**Code source complet** dans `tibi-platform/src/` :
- 6 phases livrées + toutes les améliorations post-review
- Les bugs reportés ont été fixés :
  - POS cart layout (items visibles)
  - Add brand redirect error (client-side exception) — fixé
  - Reception filter PostgREST — fixé
  - Price missing bug dans onboarding — fixé
  - PDF filename em-dash (downloads qui ne marchaient pas) — fixé

**Features ajoutées récemment** :
- Sellers peuvent Close day (POS header → "Close day")
- Brand payments UI (section dans brand detail — record payment + history)
- Customer database avec upsert automatique (page `/admin/customers`)
- Pre-order "Collect → POS" pré-rempli (panier + customer)
- Stock adjustments avec audit trail complet (+ page `/admin/stock/history`)
- CSV export sur Accounting
- Reports avec 4 tabs : Sales / Brands / Inventory / Wholesale & Editions
- Full PDF export multi-pages
- Dormant stock truncation + "See all" page
- Image click-to-zoom sur toutes les photos produits
- POS UX : pulse + flash + auto-scroll + discount en %
- Visual pass A : hover cards + shadows légers + zebra tables + hover crème
- Daily close accessible aux sellers
- Restock banner cliquable avec drafts WhatsApp/email
- Settings en tabs horizontaux

### 🗄️ Base de données (seed réaliste prêt)

**11 marques actives** (10 consignment + Tibi Editions) avec commissions setées :
- 27% : Desirée Iyama, Dye Lab, MòYE, Studio Bonnitta, Oriré, NG Couture, KADIJU
- 30% : Arami, Aduscent (beauty)
- 28% : Olooh Concept
- Tibi Editions : own_label (pas de commission)

**47 variants** avec stock varié (9 sold-out), 1 avec photo.

**Données de test générées** :
- 30 ventes étalées sur 14 jours, GMV 3 355 100 XOF (~3,3M)
- 15 clients uniques (avec email + téléphone)
- 3 pre-orders : 1 pending, 1 ready, 1 collected
- 1 return
- 2 stock adjustments (damaged, lost)
- 1 brand payment partiel (sur Dye Lab)

### 🔑 Identifiants

- **Admin** : `hello@ismathlauriano.com` / `Ismathlau04.`
- **Seller partagé** : `pos@tibiconceptstore.com` / `TibiPOS2026`

### 🔧 Config

- Supabase URL : `https://yyihvehsdjxmpgoszbfk.supabase.co`
- Resend API key ajoutée dans `.env.local` (utilise `onboarding@resend.dev` comme sender tant que le domaine n'est pas vérifié)
- Domaine à vérifier plus tard chez Resend pour envoyer depuis `hello@ismathlauriano.com`

---

## ⚠️ Problème bloquant à résoudre

**Build Next.js ne termine pas proprement sur cette machine.**

**Cause identifiée** : le projet est dans **Google Drive synchronisé**. Pendant le `next build`, Google Drive sync duplique les fichiers (`file 2.json`, `file 3.json`) ce qui provoque des ETIMEDOUT I/O et laisse le build dans un état inconsistant.

**Signes** :
- `.next/` contient des fichiers dupliqués `xxx 2.json`, `xxx 3.json`
- Erreur `ETIMEDOUT: connection timed out, read` pendant le build
- Le `next start` ne démarre pas car `.next` est partiel/corrompu

### Solution recommandée

**Option A (propre, recommandée)** : Déplacer le projet hors de Google Drive
```bash
# Copier le projet vers un dossier local non-synchronisé
cp -R "/Users/IsmathLauriano/Desktop/Tibi presentation/tibi-platform" ~/Documents/tibi-platform
cd ~/Documents/tibi-platform
rm -rf .next node_modules
npm install --ignore-scripts
NEXT_TELEMETRY_DISABLED=1 npm run build
npm start
```

**Option B (rapide)** : Mettre le dossier `.next` en pause de sync Google Drive
- Google Drive → Préférences → Paramètres du dossier → Exclure `.next/`
- Puis rebuild normalement

**Option C** : Utiliser `next dev` (plus lent mais moins sensible aux duplicates)
```bash
cd "/Users/IsmathLauriano/Desktop/Tibi presentation/tibi-platform"
npm run dev
```

---

## 🧪 À tester une fois le serveur démarré

Voir le fichier `TEST-SCENARIOS.md` pour les 12 scénarios détaillés :
1. Vente simple POS
2. Vente avec discount + customer
3. Return
4. Pre-order 3 états + création
5. Onboarding marque + reception admin
6. Stock management + adjust
7. Brand payment
8. Reports (4 tabs + PDF + CSV)
9. Accounting
10. Daily close
11. Brand dashboard externe
12. Seller restrictions

---

## 🗺️ Roadmap V2 (déjà validé)

**Priorité haute, pas encore implémenté** :
- **Backup auto quotidien** de la BDD (cron sur Netlify — à setup)
- **Alertes email automatiques** : stock bas, fin de cycle dans 7j, nouveau pre-order
- **Auto accounting email mensuel** au comptable le 1er du mois
- **Daily close comparison** avec jour d'avant + graphique semaine passée
- **Exchange en 1 clic** (alternative au return + nouvelle vente)

**Pas urgent** :
- Customer loyalty tags VIP
- Taxes/TVA (à activer si Tibi y est assujetti)
- Multi-location
- E-commerce vitrine publique

---

## 📁 Fichiers clés

- `src/app/` — toutes les pages (admin, pos, brand, onboarding)
- `src/lib/data/` — data access (brands, variants, reports, accounting, pos)
- `src/lib/pdf/` — templates PDF (invoice, labels, brand-report, reports, accounting)
- `src/app/api/` — endpoints PDF + labels + uploads
- `supabase/migrations/` — schema BDD
- `TEST-SCENARIOS.md` — scénarios de test
- `.env.local` — config Supabase + Resend (à ne JAMAIS committer)

---

## Pour démarrer la prochaine conversation

Ouvre une nouvelle conversation Claude, colle ceci :

> "Je continue le projet Tibi Retail Platform. Le code est à `/Users/IsmathLauriano/Desktop/Tibi presentation/tibi-platform`. Lis le fichier `HANDOFF.md` et `TEST-SCENARIOS.md` pour le contexte. Le problème actuel : le build ne termine pas à cause de la sync Google Drive qui duplique des fichiers dans .next. Aide-moi à déplacer le projet hors de Google Drive ou exclure .next de la sync, puis rebuild et démarre le serveur prod."

Claude reprendra où on s'est arrêté.
