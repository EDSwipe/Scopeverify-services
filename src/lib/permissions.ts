import type { UserRole, Permission } from '../types'

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
  client: [
    'manage_missions', // Peut créer et gérer ses propres missions
  ],
  collaborator: [
    'manage_missions', // Peut mettre à jour les missions assignées
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
