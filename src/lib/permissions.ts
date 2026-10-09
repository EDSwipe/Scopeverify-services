import type { ModeratorPermission, Permission, User, UserRole } from '../types'

export const moderatorPermissionOptions: { value: ModeratorPermission; label: string; description: string }[] = [
  { value: 'partners.review', label: 'Qualifier les partenaires', description: 'Consulter les dossiers, documents et historique; statuer et ajouter des notes internes.' },
  { value: 'partners.documents', label: 'Gérer les justificatifs', description: 'Modifier les types et dates de validité des documents partenaires.' },
]

export const defaultModeratorPermissions: ModeratorPermission[] = ['partners.review', 'partners.documents']

export function hasModeratorPermission(user: Pick<User, 'role' | 'is_active' | 'permissions'>, permission: ModeratorPermission): boolean {
  if (!user.is_active) return false
  if (user.role === 'admin') return true
  return user.role === 'moderator' && !!user.permissions?.includes(permission)
}

// Définition des permissions par rôle
export const rolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    'manage_users',
    'manage_missions',
    'manage_collaborators',
    'manage_clients',
    'validate_missions',
    'view_all_missions',
    'manage_settings',
  ],
  moderator: [],
  client: [
    'manage_missions', // Peut créer et gérer ses propres missions
  ],
  collaborator: [
    'manage_missions', // Peut mettre à jour les missions assignées
  ],
  partner: [
    'manage_missions', // Accès opérationnel après validation uniquement
  ],
}

// Vérifier si un utilisateur a une permission spécifique
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) || false
}

// Vérifier si un utilisateur a au moins une des permissions requises
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission))
}

// Vérifier si un utilisateur a toutes les permissions requises
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(role, permission))
}
