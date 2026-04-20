# Tibi Retail Platform — Scénarios de test

Ce document liste les scénarios à dérouler pour valider chaque flow de la plateforme.

**Identifiants** :
- Admin (Ismath) : `hello@ismathlauriano.com` / `Ismathlau04.`
- Seller (vendeuses partagé) : `pos@tibiconceptstore.com` / `TibiPOS2026`

**URL locale** : http://localhost:3000

---

## Scénario 1 — Vente simple au POS (client sans contact)

1. Login seller
2. Aller sur **POS** (page d'accueil seller)
3. Search "t-shirt" dans la barre → sélectionner 1 "T-shirt teinture" Dye Lab, taille M
4. Cliquer **Add** — vérifier que l'item apparaît dans le panier (flash crème + pulse "Cart")
5. Ajouter un 2e item différent (ex: Bougie Olooh) — vérifier auto-scroll
6. Payment method = **Cash**
7. Seller = **Ismath**
8. Pas de customer, pas de notes
9. Cliquer **Complete Sale**
10. ✅ Modal "Sale completed" s'affiche avec le total, invoice #, option de send
11. Cliquer **View PDF invoice** → nouvel onglet avec la facture PDF
12. Fermer la modal → panier vide, prêt pour vente suivante

**À vérifier** :
- Stock des 2 items a baissé de 1 dans Stock
- La vente apparaît dans POS → Sales
- Apparaît dans Admin → Reports → Sales

---

## Scénario 2 — Vente avec discount 10% et customer

1. POS → Add 2 items (un consignment, un Tibi Editions)
2. **Discount** : 10 (percentage)
3. **Reason** : "Late season"
4. **Payment** : Mobile Money
5. **Seller** : Vendeuse 1
6. **Customer name** : Marie Test
7. **Customer contact** : `marie.test@email.com`
8. **Notes** : "VIP client"
9. Complete Sale
10. ✅ PDF invoice montre le discount correctement
11. Va dans Admin → Customers → "Marie Test" apparaît avec 1 purchase

---

## Scénario 3 — Return (retour d'un item)

1. POS → **Returns**
2. Lookup par invoice # (prends une des 30 ventes existantes — va dans Sales pour trouver un #)
3. Cocher un item à retourner
4. **Reason** : "Size not right"
5. **Seller** : Ismath
6. Cliquer **Process return**
7. ✅ Badge "Return processed" + montant refundé
8. Va dans Stock → l'item a regagné 1 en stock
9. Va dans Reports → Sales → tu vois la ligne "Returns today" dans Daily close

---

## Scénario 4 — Pre-order (3 états)

1. Admin → **Pre-orders**
2. Tu vois 3 pre-orders : 1 pending, 1 ready, 1 collected
3. Expand le pending (clique sur la ligne) — voir détails items
4. Sur le pending → clique **Mark ready** → change en vert
5. Sur le ready → clique **Collect → POS** → tu es redirigée sur POS avec panier pré-rempli + customer
6. Complete Sale normalement (pour encaisser le balance restant)
7. ✅ Vente enregistrée, preorder passe "collected"

**Créer un nouveau pre-order** :
1. POS → **Pre-order**
2. Customer : nom + email + téléphone (tous obligatoires)
3. Search un item existant OU clique **Quick add** pour créer un item qui n'existe pas
4. Ajoute 1-2 items, quantités variables
5. Deposit : 20000
6. Save → visible dans Admin → Pre-orders en "pending"

---

## Scénario 5 — Onboarding marque (vue brand externe)

1. Admin → **Brands** → clique "Dye Lab"
2. Copier le **Onboarding link** (dans share-link panel)
3. Ouvre ce lien dans un nouvel onglet **sans être connectée** (navigation privée)
4. Step 1 : modifier quelques infos, Continue
5. Step 2 :
   - Ajoute 2-3 items avec nom/size/color/prix
   - Upload une photo sur un item → compressée auto
   - Clique **Duplicate** sur une ligne pour dupliquer
6. Step 3 : review, Submit
7. ✅ Page de confirmation

**Côté admin** :
8. Retour admin dashboard → bannière jaune "X items waiting for reception"
9. Clique → Admin → **Receptions**
10. Voir la marque Dye Lab avec les nouveaux items + photos (cliquer pour zoom)
11. Ajuster la quantité reçue sur 1 item (ex: 4 au lieu de 5)
12. Cliquer **Confirm** sur chaque ou **Confirm all sent quantities**
13. ✅ Items visibles au POS après confirmation

---

## Scénario 6 — Stock management + adjust

1. Admin → **Stock**
2. Filter par brand "Dye Lab"
3. Sélectionner 3 items via checkboxes → **Print labels** → PDF s'ouvre (barcodes imprimables)
4. **Export CSV** → télécharge liste stock
5. Sur un item avec stock 5, clique **Adjust**
6. Nouvelle qty : 3
7. Reason : **Damaged**
8. Notes : "2 items tachés pendant transport"
9. Save → stock à 3
10. Admin → **Stock → Adjustment history →** : ton adjustment apparaît avec date, delta −2, raison, notes

---

## Scénario 7 — Brand detail + paiement

1. Admin → **Brands** → cliquer une brand avec des ventes (ex: Dye Lab)
2. Commission section → vérifier le %
3. **Payments** section :
   - Balance due affichée
   - Historique : 1 paiement partiel déjà fait (sur Dye Lab uniquement)
   - Cliquer **Record payment** → montant pré-rempli avec balance
   - Saisir une note → Save
   - ✅ Paiement apparaît dans l'historique, balance descend

---

## Scénario 8 — Reports admin (tous les onglets)

1. Admin → **Reports**
2. Cliquer **Cycle** → les 30 ventes, GMV 3M+, Tibi CA, etc.
3. Onglet **Sales** : voir graphique GMV sur le temps, charts payment/hour/weekday, tables seller/top items/dormant (10 + See all)
4. Cliquer **Export CSV** sur By seller → téléchargé
5. Onglet **Brands** : ranking par GMV, sell-through, commission, stock value
6. Onglet **Inventory** : stock value, balance due, low-stock, projection fin de cycle, comparison cycle
7. Onglet **Wholesale & Editions** : marges, cost vs retail, profit
8. **Download PDF** (en haut) → fichier PDF complet multi-pages

---

## Scénario 9 — Accounting (comptable)

1. Admin → Reports → **Accounting**
2. Filter par Month → choisir mois courant
3. Voir **Tibi CA imposable** (en haut, clairement séparé)
4. Section Consignation : gross collecté (NOT Tibi revenue) / commissions / dû / payé / reste
5. Section Wholesale + Tibi Editions : ventes / COGS / marge
6. Cliquer **PDF** → télécharger pour comptable
7. Cliquer **CSV** → télécharger chiffres tableur

---

## Scénario 10 — Daily close

1. POS (ou Admin Reports) → **Close day**
2. Voir récap today : tx count, GMV, avg basket, returns
3. Par payment method, par seller
4. Cliquer **Close day**
5. ✅ Badge "Day closed"
6. Tu reçois un email récap à `hello@ismathlauriano.com` (si Resend configuré)

---

## Scénario 11 — Brand dashboard (vue marque externe)

1. Admin → **Brands** → Dye Lab → copier **Dashboard link**
2. Ouvre en navigation privée (pas de login)
3. ✅ Tu vois les stats de Dye Lab en NGN (devise native)
4. Items Sent / Sold / Remaining / Balance Due
5. Stock table avec photos (cliquer pour zoomer)
6. Payment history (1 paiement partiel)
7. **Download Cycle report PDF**

---

## Scénario 12 — Seller restrictions

1. Logout → login en **seller** (`pos@tibiconceptstore.com` / `TibiPOS2026`)
2. ✅ Tu vois uniquement : Sell / Sales / Stock / Returns / Pre-order / Close day
3. Pas d'accès à : Admin, Reports, Accounting, Brands edit, Commissions, Settings
4. Stock accessible : oui, tu peux voir et ajouter un item
5. Dans le formulaire Add item, **pas de champ cost price** (masqué pour seller)
6. Pas de bouton **Adjust** sur les variants (admin only)

---

## Points à vérifier transversalement

- **Realtime sur brand dashboard** : fais une vente au POS pendant que tu as le brand dashboard ouvert dans un autre onglet — la vente doit apparaître sans refresh
- **Photos zoom** : clique sur toutes les photos produits → s'agrandissent
- **Hover cards** : les cards ont un hover léger (shadow + border un peu + foncée)
- **Tables zebra** : 1 ligne sur 2 avec un fond très léger
- **POS UX** : pulse sur "Cart" + flash sur la ligne ajoutée + auto-scroll

---

## Si tu trouves un bug

Note :
- URL de la page
- Action faite (clic, formulaire, etc.)
- Message d'erreur exact
- Screenshot si possible

Je peux fixer en temps réel ou batch selon priorité.
