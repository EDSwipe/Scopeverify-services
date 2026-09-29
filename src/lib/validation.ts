import { z } from 'zod'

// Schéma de validation pour l'inscription
export const signupSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  fullName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  company: z.string().optional(),
  role: z.enum(['client', 'collaborator']),
})

// Schéma de validation pour la connexion
export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
})

// Schéma de validation pour le formulaire de contact
export const contactSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  company: z.string().optional(),
  email: z.string().email('Email invalide'),
  phone: z.string().optional(),
  mission: z.string().min(10, 'La description de la mission doit contenir au moins 10 caractères'),
})

// Schéma de validation pour la création de mission
export const missionSchema = z.object({
  title: z.string().min(3, 'Le titre doit contenir au moins 3 caractères'),
  description: z.string().optional(),
  missionType: z.enum(['simple_visit', 'verification', 'supplier_visit', 'technical_mission', 'field_day', 'custom']),
  location: z.string().min(2, 'Le lieu est requis'),
  budget: z.string().optional(),
  checklist: z.array(z.string()).optional(),
})

// Schéma de validation pour la création de collaborateur
export const collaboratorSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  fullName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  company: z.string().optional(),
})

// Schéma de validation pour la création de client
export const clientSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  fullName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  company: z.string().optional(),
})

// Schéma de validation pour le rapport de mission collaborateur
export const missionReportSchema = z.object({
  observations: z.string().min(10, 'Les observations doivent contenir au moins 10 caractères'),
  results: z.string().min(10, 'Les résultats doivent contenir au moins 10 caractères'),
  findings: z.string().optional(),
  notes: z.string().optional(),
  photos: z.array(z.object({
    path: z.string(),
    name: z.string(),
    url: z.string().optional(),
  })).optional(),
})

// Types TypeScript inférés des schémas
export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ContactInput = z.infer<typeof contactSchema>
export type MissionInput = z.infer<typeof missionSchema>
export type CollaboratorInput = z.infer<typeof collaboratorSchema>
export type ClientInput = z.infer<typeof clientSchema>
export type MissionReportInput = z.infer<typeof missionReportSchema>
