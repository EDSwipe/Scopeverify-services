# Scope-Verify

Application React 19, TypeScript et Vite avec Supabase Auth, PostgreSQL/RLS et Storage.

## Parcours

- La page publique présente le service, les besoins, le parcours de mission, le réseau sélectionné et les zones d’intervention.
- Les clients créent et suivent leurs missions, précisent questions, budget et délai, joignent des documents et consultent les restitutions.
- Les professionnels déposent une fiche de qualification en plusieurs étapes. Une candidature reste en attente jusqu’à validation par un administrateur ou modérateur.
- L’administration permet de qualifier les partenaires reçus en ligne ou hors ligne, gérer leurs documents et validités, suivre les statuts, affecter les missions et choisir les seules présentations publiques.
- Le tableau client, l’espace opérationnel collaborateur, le CMS détaillé, la géographie, le CRM, le pipeline, le calendrier et les témoignages existants restent disponibles.

## Rôles

Les rôles stockés en base sont `admin`, `moderator`, `client`, `collaborator` et `partner`. Un partenaire n’accède à l’espace opérationnel qu’après passage au statut `referenced` ou `network` et activation de son compte. Les statuts `rejected` et `suspended` n’accordent pas d’accès opérationnel.

Les profils complets, justificatifs et notes internes sont privés. L’annuaire public est une projection séparée contenant uniquement les champs publiés par Scope-Verify.

## Configuration

Copier `.env.example` vers `.env` et renseigner les variables Supabase attendues par `src/supabase.ts`. Le projet utilise aussi les routes API du dossier `api/` pour les notifications.

## Base Supabase

Appliquer d’abord les scripts de schéma et de sécurité déjà utilisés par le projet, en particulier `supabase/migration_mission_system.sql`, `supabase/security_hardening.sql` et les migrations de contenu/CMS. Appliquer ensuite `supabase/migrations/20261001_partner_network.sql` dans le SQL Editor Supabase.

Cette migration additive ajoute les rôles, profils et documents partenaires, l’historique, les colonnes d’échéance et d’affectation mission, les politiques RLS et les buckets Storage privés/publics. Elle ne supprime ni ne convertit les missions ou comptes existants. La page d’administration et la candidature partenaire ne fonctionneront pas avant son application.

## Développement et validation

```sh
npm install
npm run dev
npm test -- --run
npm run build
npm run lint
```

Le lint global contient des diagnostics historiques dans plusieurs modules existants ; vérifier le résultat complet avant d’envisager un nettoyage séparé.
