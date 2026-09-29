# ✅ Checklist d'activation - MVP Mission Management

> **Statut**: Site en production sur https://scopeverify-services.com  
> **Build**: ✅ Succès (644 kB Gzip)  
> **Deploy**: ✅ Vercel Active  
> **Date**: 10 Septembre 2026

---

## 🎯 Étapes finales (10 minutes)

### 1️⃣ Activer la migration Supabase (3 min)

**Situation**: Les nouvelles tables n'existent pas encore dans Supabase

**Action:**

1. Accédez à [Supabase Dashboard](https://app.supabase.com)
2. Sélectionnez le projet **jxulrbovjiizilljblej**
3. Allez dans **SQL Editor** → **New Query**
4. Copiez **tout le contenu** du fichier:
   ```
   supabase/migration_mission_system.sql
   ```
5. Collez dans l'éditeur
6. Cliquez **Run** (⏵ button en haut à droite)
7. Attendez 10-15 secondes (notification "Query completed successfully")

**Résultat attendu:**
- 4 nouvelles tables créées ✅
- RLS policies appliquées ✅
- Indexes créés ✅

---

### 2️⃣ Créer le bucket Storage (2 min)

**Situation**: Les uploads de fichiers ne fonctionneront pas sans bucket

**Action:**

1. Dans Supabase Dashboard → **Storage**
2. Cliquez **New Bucket**
3. Configurez:
   - **Name**: `mission-documents`
   - **Public bucket**: ✅ Cochez
   - **File size limit**: 50 MB
4. Cliquez **Create Bucket**
5. Le bucket est prêt 🎉

**Résultat attendu:**
- Bucket `mission-documents` visible dans la liste ✅
- Icône publique 🔓 visible ✅

---

### 3️⃣ Configurer les URL de redirection Auth (2 min)

**Situation**: Auth redirige vers le mauvais domaine sinon

**Action:**

1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. Trouvez **Site URL** → Changez en:
   ```
   https://scopeverify-services.com
   ```
3. Trouvez **Redirect URLs** → Ajoutez ces deux:
   ```
   https://scopeverify-services.com
   https://scopeverify-services.com/
   ```
4. Cliquez **Save**

**Résultat attendu:**
- Site URL: `https://scopeverify-services.com` ✅
- 2 redirect URLs visibles ✅

---

### 4️⃣ Créer le compte admin initial (1 min)

**Situation**: L'email admin (sotbirida@yahoo.fr) n'a pas encore de mot de passe

**Action (Option A - Via Supabase Dashboard):**

1. Supabase Dashboard → **Authentication** → **Users**
2. Cliquez **Add user**
3. Email: `sotbirida@yahoo.fr`
4. Password: (créez un mot de passe fort)
5. Cliquez **Add User**

**Ou Option B - Via SQL (si Option A ne marche pas):**

1. Allez dans **SQL Editor**
2. Exécutez cette requête:
```sql
-- Exécuter UNE SEULE FOIS
-- Remplacer YOUR_UUID avec un vrai UUID (ex: 550e8400-e29b-41d4-a716-446655440000)

insert into public.users (id, email, role, full_name, is_active)
values (
  'YOUR_UUID_ICI',  -- À remplacer
  'sotbirida@yahoo.fr',
  'admin',
  'Admin',
  true
);
```

**Résultat attendu:**
- Compte admin visible dans Auth → Users ✅
- Peut se connecter avec email + mot de passe ✅

---

### 5️⃣ Tester en production (2 min)

**Étape 1 - Test public:**

```
Ouvrir: https://scopeverify-services.com
✅ La page d'accueil se charge
✅ Les boutons "Connexion" et "Créer un compte" sont visibles
```

**Étape 2 - Test signup client:**

```
Cliquer: "Créer un compte"
- Nom: "Jean Dupont"
- Email: test-client-1@example.com (DOIT être unique)
- Password: TestPass123!
- Type: Client
Cliquer: "S'inscrire"
✅ Redirige vers dashboard client
✅ Affiche "Bienvenue, Jean Dupont"
```

**Étape 3 - Test formulaire mission:**

```
Cliquer: "+ Nouvelle mission"
- Type: "Visite simple + photos"
- Titre: "Visite fournisseur Shanghai"
- Lieu: "Shanghai, Chine"
- Description: "Vérifier la production..."
- Budget: "1500 EUR"
Cliquer: "Créer la mission"
✅ Message "Mission sauvegardée avec succès !"
✅ Mission apparaît dans la liste
```

**Étape 4 - Test admin:**

```
Déconnexion (bouton haut-right)
Cliquer: "Connexion"
- Email: sotbirida@yahoo.fr
- Password: (votre mot de passe)
Cliquer: "Se connecter"
✅ Redirige vers dashboard admin
✅ Tableau avec toutes les missions visible
✅ Bouton "Assigner" disponible
```

**Étape 5 - Test assignation:**

```
Dans Admin Dashboard:
Créer d'abord un collaborateur (créer compte avec rôle Collaborator)
Puis:
- Cliquer sur "Assigner" pour une mission
- Sélectionner le collaborateur
- Cliquer "Assigner"
✅ Mission passe de "Non assignée" à "Assignée"
```

**Étape 6 - Test collaborateur:**

```
Déconnexion
Créer un compte Collaborateur (ou en créer un avec Supabase)
Une mission doit vous être assignée
✅ Dashboard collaborateur affiche la mission
✅ Bouton "Voir les détails" fonctionne
✅ Dropdown de statut fonctionne
```

---

## 🚀 Vous êtes prêts !

Après avoir complété les 5 étapes ci-dessus, vous avez:

✅ **Base de données complète** avec 4 tables + RLS  
✅ **Authentification fonctionnelle** pour 3 rôles  
✅ **3 dashboards opérationnels**:
  - Dashboard Client (créer/suivre missions)
  - Dashboard Admin (gérer tout)
  - Dashboard Collaborateur (voir missions assignées)  
✅ **Système d'assignation** entre admin et collaborateurs  
✅ **Prêt pour la production** sur scopeverify-services.com

---

## 🆘 Si quelque chose ne marche pas

| Problème | Solution |
|----------|----------|
| "Page blanche" | F5 (refresh) ou Ctrl+Shift+R (cache) |
| "Supabase not configured" | Variables d'env OK sur Vercel? Redeploy: `vercel --prod --force` |
| Auth ne marche pas | Vérifier URL Redirect dans Supabase (étape 3) |
| Signup ok mais rien ne s'affiche | Vérifier console (F12 → Console) pour erreurs |
| Admin ne voit aucune mission | Tables pas créées? Re-exécuter migration SQL (étape 1) |
| Assignation échoue | Collaborateur doit exister dans `users` table |

---

## 📞 Contacts importants

- **Supabase Project**: jxulrbovjiizilljblej
- **Vercel Deploy**: scopeverify-services.com
- **Admin Email**: sotbirida@yahoo.fr
- **Support Files**: MISSION_SYSTEM_SETUP.md, IMPLEMENTATION_SUMMARY.md

---

## 🎉 Prochaines améliorations (Phase 2)

Après 2-3 semaines d'utilisation, considérer:

- [ ] Upload photos/documents (déjà codé, juste activé manquement)
- [ ] Notifications par email (Resend API prêt)
- [ ] Commentaires sur missions
- [ ] Historique/audit log
- [ ] Export PDF rapports
- [ ] Intégration calendrier

**Tout est prêt techniquement, juste besoin de feedback utilisateurs! 🚀**
