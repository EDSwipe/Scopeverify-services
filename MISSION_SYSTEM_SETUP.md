# MVP Mission Management System - Setup Guide

## 🚀 Déploiement du système complet

### 1. Déployer le schéma Supabase

Le fichier `supabase/migration_mission_system.sql` contient toutes les tables et policies nécessaires.

**Étapes :**

1. Allez à [Supabase Dashboard](https://app.supabase.com)
2. Sélectionnez le projet `jxulrbovjiizilljblej`
3. Allez dans **SQL Editor**
4. Créez une nouvelle requête
5. Copiez le contenu de `supabase/migration_mission_system.sql`
6. Exécutez la requête

**Ou via Supabase CLI :**

```bash
supabase migration new add_mission_system
# Copier le contenu de migration_mission_system.sql
supabase db push
```

### 2. Configurer Supabase Storage

Le système gère l'upload de documents. Il faut créer un bucket public.

**Via Supabase Dashboard :**

1. Allez dans **Storage**
2. Créez un nouveau bucket appelé `mission-documents`
3. Configurez les permissions :
   - Public policy: `SELECT`
   - Authenticated: `INSERT`, `UPDATE`, `DELETE`

**Ou via SQL :**

```sql
insert into storage.buckets (id, name, public)
values ('mission-documents', 'mission-documents', true);

create policy "Authenticated users can upload" on storage.objects
  for insert with check (
    bucket_id = 'mission-documents'
    and auth.role() = 'authenticated'
  );

create policy "Users can view documents" on storage.objects
  for select using (bucket_id = 'mission-documents');
```

### 3. Activer Supabase Auth

Les fonctionnalités d'authentification sont pré-configurées dans le code.

**Vérifier dans Supabase Dashboard :**

1. Allez dans **Authentication** → **Providers**
2. Assurez-vous qu'Email est activé
3. Allez dans **URL Configuration** et vérifiez :
   - Site URL: `http://localhost:5173` (dev) ou `https://scopeverify-services.com` (prod)
   - Redirect URLs: `http://localhost:5173` et `https://scopeverify-services.com`

### 4. Ajouter l'admin initial

L'admin doit avoir un compte avec le rôle 'admin'. Vous pouvez l'ajouter manuellement :

```sql
-- Remplacer uuid_ici avec un UUID généré, ex: gen_random_uuid()
insert into public.users (id, email, role, full_name, is_active)
values ('00000000-0000-0000-0000-000000000001', 'sotbirida@yahoo.fr', 'admin', 'Admin', true);
```

Puis créer le compte via Supabase Auth Dashboard.

### 5. Tester en local

```bash
# Installation
npm install

# Démarrage
npm run dev

# Accédez à http://localhost:5173
```

### 6. Déployer sur Vercel

```bash
# Build production
npm run build

# Déployer
vercel --prod --yes --force
```

---

## 📋 Fonctionnalités disponibles

### Publique
- Page d'accueil avec présentation des services
- Affichage des missions et tarifs
- Formulaire de contact

### Authentifiée

**Client :**
- ✅ Création de missions (brouillon)
- ✅ Soumettre une mission
- ✅ Suivre l'état d'avancement
- ✅ Upload de documents
- ✅ Voir les collaborateurs assignés

**Collaborateur :**
- ✅ Voir les missions assignées
- ✅ Mettre à jour le statut
- ✅ Upload de documents (photos, rapports)
- ✅ Voir les commentaires/notes

**Admin :**
- ✅ Voir toutes les missions
- ✅ Changer le statut des missions
- ✅ Assigner à un collaborateur
- ✅ Gérer les collaborateurs (créer, activer/désactiver)
- ✅ Voir les statistiques

---

## 🔐 Architecture de sécurité

Les Row Level Security (RLS) policies garantissent que :
- Les clients ne voient que leurs propres missions
- Les collaborateurs ne voient que les missions qui leur sont assignées
- L'admin peut tout voir et modifier

Aucun contournement n'est possible depuis le client puisque tout est validé côté serveur.

---

## 📧 Notifications par email (Optionnel)

Pour les notifications automatiques lors de l'assignation de mission :

1. Créez un Edge Function Supabase (ou utilisez Vercel serverless)
2. Appelez l'API Resend existante
3. Exemple :

```typescript
// Lors de l'assignation
await fetch('/api/mission-notification', {
  method: 'POST',
  body: JSON.stringify({
    collaborator_email: collaborator.email,
    mission_title: mission.title,
    mission_id: mission.id,
  }),
})
```

---

## 🐛 Troubleshooting

**Erreur "Supabase not configured"**
- Vérifiez que `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont définis

**Auth ne fonctionne pas**
- Vérifiez les URL Redirect dans Supabase Auth settings
- Confirmez que les tables users existent

**Upload de fichiers échoue**
- Vérifiez que le bucket `mission-documents` existe
- Vérifiez les permissions du bucket

---

## 📝 Structure des fichiers

```
src/
├── components/
│   ├── Auth/
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   └── Auth.css
│   ├── ClientDashboard/
│   │   ├── ClientDashboard.tsx
│   │   ├── MissionForm.tsx
│   │   ├── MissionsList.tsx
│   │   └── *.css
│   ├── AdminDashboard/
│   │   ├── AdminDashboard.tsx
│   │   └── AdminDashboard.css
│   └── CollaboratorDashboard/
│       ├── CollaboratorDashboard.tsx
│       └── CollaboratorDashboard.css
├── lib/
│   ├── useAuth.ts (Hook d'authentification)
│   └── missions.ts (API missions, assignments, documents)
├── types.ts (Types TypeScript)
├── AppRouter.tsx (Routage principal)
└── supabase.ts (Configuration Supabase)

supabase/
├── setup.sql (Schema initial)
└── migration_mission_system.sql (Nouvelles tables et policies)
```

---

## ✅ Checklist avant production

- [ ] Migration SQL exécutée dans Supabase
- [ ] Storage bucket créé et configuré
- [ ] Admin user créé dans Supabase Auth
- [ ] URL Redirect configurées correctement
- [ ] Variables d'environnement déployées sur Vercel
- [ ] Build test local: `npm run build && npm run preview`
- [ ] Test login/signup en local
- [ ] Test client dashboard (créer mission)
- [ ] Test admin dashboard (assigner mission)
- [ ] Déploiement: `npm run build && vercel --prod`
