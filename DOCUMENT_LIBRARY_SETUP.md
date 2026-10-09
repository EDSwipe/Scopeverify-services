# Bibliothèque de documents

## Déploiement

1. Appliquer manuellement `supabase/migrations/20261009_document_library.sql` dans l’environnement Supabase voulu. Cette migration n’est pas exécutée par le projet et ne doit pas être lancée en production sans revue préalable.
2. Si des lignes existent déjà dans `legal_documents`, vérifier que le bucket `legal-documents` existe et est privé. La migration importe les métadonnées et référence les fichiers existants sans les déplacer; elle échoue volontairement si ce bucket est absent ou public.
3. Configurer dans Vercel les variables déjà utilisées par les routes serveur : `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` et `VITE_ADMIN_EMAIL`. La clé de service reste uniquement côté serveur. Aucune nouvelle variable d’environnement n’est requise.
4. Redéployer l’application pour publier la nouvelle route `/api/document-library` et l’interface d’administration. Les ajouts/remplacements ultérieurs ne nécessitent pas de redéploiement.

Le bucket créé par migration, `document-library`, est privé, accepte PDF, DOCX, XLSX, JPEG, PNG et WebP jusqu’à 3 Mo. Les uploads passent par la route Vercel qui vérifie l’identité admin, le MFA, le type annoncé et la signature du contenu. Les URLs de téléchargement sont signées pour cinq minutes et les réponses API ne sont pas mises en cache.

## Utilisation

Depuis l’onglet **Bibliothèque de documents**, créer le document avec sa clé stable et ses métadonnées, ajouter une version, puis publier explicitement la version voulue. Un remplacement ne change pas la version active avant publication. L’archivage retire le document des résolutions futures tout en conservant les fichiers, les usages et l’historique.

Les six catégories initiales sont des emplacements vides. Elles peuvent être complétées ou désactivées dans l’interface; l’administrateur peut en créer de nouvelles. Les documents juridiques historiques, s’ils existent, sont importés comme version 1 publiée dans « Documents clients et administratifs », avec leur chemin de stockage d’origine.

## Intégration ultérieure

Utiliser `resolvePublishedDocument({ key: 'cle-stable' })` pour résoudre un document précis ou `resolvePublishedDocument({ category: 'cle-categorie' })` pour obtenir les documents publiés visibles de cette catégorie. Le résultat contient une URL temporaire et l’identifiant exact de la version. Les intégrations métier devront enregistrer cet identifiant de version sur les documents générés/transmis; aucun formulaire ni processus métier n’est câblé à cette étape.

Les usages actuellement saisis dans l’interface sont des références de catalogue destinées au suivi administratif. Ils ne modifient pas automatiquement les formulaires ni les missions existantes.

## Limites connues

- La détection réelle du contenu est fondée sur les signatures de fichiers et la structure ZIP DOCX/XLSX; elle ne remplace pas une analyse antivirus.
- Les anciennes lignes `legal_documents` n’ayant ni taille ni empreinte enregistrées apparaissent avec ces informations indisponibles. Le fichier original reste dans son bucket historique jusqu’à son remplacement ou à une opération ultérieure de conservation validée.
- La résolution par clé/catégorie est disponible pour les futurs processus, mais aucun parcours client/partenaire ne la consomme encore.
- Les tests automatisés couvrent la validation des métadonnées de fichier. Les tests RLS, Storage et publication doivent être exécutés sur un projet Supabase de test après application de la migration; aucune migration de production n’a été lancée.
