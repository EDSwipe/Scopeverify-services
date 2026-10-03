# Configuration des documents juridiques

## Instructions pour la configuration

### 1. Exécuter la migration SQL

Exécutez le fichier `supabase-migrations-legal-documents.sql` dans votre base de données Supabase pour créer la table `legal_documents` avec les politiques RLS appropriées.

### 2. Créer le bucket de stockage

Le bucket de stockage doit être créé manuellement dans la console Supabase:

1. Connectez-vous à votre console Supabase
2. Allez dans la section "Storage"
3. Cliquez sur "New bucket"
4. Nommez le bucket: `legal-documents`
5. Configurez les options:
   - **Public bucket**: Non (cocher "Make bucket private")
   - **File size limit**: 10MB ou plus selon vos besoins
   - **Allowed MIME types**: application/pdf

### 3. Configurer les politiques RLS pour le bucket

Une fois le bucket créé, configurez les politiques RLS dans la console Supabase Storage:

**Politique de lecture (SELECT):**
- Nom: `Admins and moderators can view legal documents`
- Opérations: SELECT
- Utilisateurs authentifiés: Oui
- Condition RLS:
```sql
EXISTS (
  SELECT 1 FROM users
  WHERE users.id = auth.uid()
  AND users.role IN ('admin', 'moderator')
)
```

**Politique d'insertion (INSERT):**
- Nom: `Admins can upload legal documents`
- Opérations: INSERT
- Utilisateurs authentifiés: Oui
- Condition RLS:
```sql
EXISTS (
  SELECT 1 FROM users
  WHERE users.id = auth.uid()
  AND users.role = 'admin'
)
```

**Politique de mise à jour (UPDATE):**
- Nom: `Admins can update legal documents`
- Opérations: UPDATE
- Utilisateurs authentifiés: Oui
- Condition RLS:
```sql
EXISTS (
  SELECT 1 FROM users
  WHERE users.id = auth.uid()
  AND users.role = 'admin'
)
```

**Politique de suppression (DELETE):**
- Nom: `Admins can delete legal documents`
- Opérations: DELETE
- Utilisateurs authentifiés: Oui
- Condition RLS:
```sql
EXISTS (
  SELECT 1 FROM users
  WHERE users.id = auth.uid()
  AND users.role = 'admin'
)
```

### 4. Utilisation

Une fois la configuration terminée:

1. Connectez-vous en tant qu'admin
2. Allez dans le tableau de bord admin
3. Cliquez sur l'onglet "⚖️ Documents juridiques"
4. Téléchargez vos documents (mentions légales, CGU, RGPD, etc.)
5. Les documents seront stockés dans Supabase Storage et leurs métadonnées dans la table `legal_documents`

### Types de documents supportés

- `mentions_legales` - Mentions légales
- `cgu` - Conditions générales d'utilisation
- `cgv` - Conditions générales de vente
- `rgpd` - Politique de confidentialité (RGPD)
- `cookies` - Politique de cookies
- `autre` - Autre document juridique

### Note importante

Les documents sont stockés de manière sécurisée et ne sont accessibles que par les administrateurs et modérateurs authentifiés. Pour les rendre accessibles publiquement sur le site, vous devrez créer un endpoint API ou une page publique qui utilise les URLs signées pour permettre aux visiteurs de télécharger les documents.
