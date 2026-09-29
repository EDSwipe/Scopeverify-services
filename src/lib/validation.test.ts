import { describe, it, expect } from 'vitest'
import {
  signupSchema,
  loginSchema,
  contactSchema,
  missionSchema,
  collaboratorSchema,
  clientSchema,
  missionReportSchema,
} from './validation'

describe('Validation Schemas', () => {
  describe('signupSchema', () => {
    it('should validate valid signup data', () => {
      const result = signupSchema.parse({
        email: 'test@example.com',
        password: 'password123',
        fullName: 'John Doe',
        company: 'Test Corp',
        role: 'client',
      })
      expect(result.email).toBe('test@example.com')
    })

    it('should reject invalid email', () => {
      expect(() =>
        signupSchema.parse({
          email: 'invalid-email',
          password: 'password123',
          fullName: 'John Doe',
          role: 'client',
        })
      ).toThrow()
    })

    it('should reject short password', () => {
      expect(() =>
        signupSchema.parse({
          email: 'test@example.com',
          password: '123',
          fullName: 'John Doe',
          role: 'client',
        })
      ).toThrow()
    })

    it('should reject invalid role', () => {
      expect(() =>
        signupSchema.parse({
          email: 'test@example.com',
          password: 'password123',
          fullName: 'John Doe',
          role: 'invalid',
        })
      ).toThrow()
    })
  })

  describe('loginSchema', () => {
    it('should validate valid login data', () => {
      const result = loginSchema.parse({
        email: 'test@example.com',
        password: 'password123',
      })
      expect(result.email).toBe('test@example.com')
    })

    it('should reject invalid email', () => {
      expect(() =>
        loginSchema.parse({
          email: 'invalid-email',
          password: 'password123',
        })
      ).toThrow()
    })
  })

  describe('contactSchema', () => {
    it('should validate valid contact data', () => {
      const result = contactSchema.parse({
        name: 'John Doe',
        company: 'Test Corp',
        email: 'test@example.com',
        phone: '+33123456789',
        mission: 'This is a mission description with more than 10 characters',
      })
      expect(result.name).toBe('John Doe')
    })

    it('should reject short mission description', () => {
      expect(() =>
        contactSchema.parse({
          name: 'John Doe',
          email: 'test@example.com',
          mission: 'Short',
        })
      ).toThrow()
    })
  })

  describe('missionSchema', () => {
    it('should validate valid mission data', () => {
      const result = missionSchema.parse({
        title: 'Test Mission',
        description: 'Test description',
        missionType: 'simple_visit',
        location: 'Paris',
        budget: '1000',
        checklist: ['item1', 'item2'],
      })
      expect(result.title).toBe('Test Mission')
    })

    it('should reject invalid mission type', () => {
      expect(() =>
        missionSchema.parse({
          title: 'Test Mission',
          missionType: 'invalid_type',
          location: 'Paris',
        })
      ).toThrow()
    })
  })

  describe('collaboratorSchema', () => {
    it('should validate valid collaborator data', () => {
      const result = collaboratorSchema.parse({
        email: 'collab@example.com',
        password: 'password123',
        fullName: 'Jane Doe',
        company: 'Test Corp',
      })
      expect(result.email).toBe('collab@example.com')
    })
  })

  describe('clientSchema', () => {
    it('should validate valid client data', () => {
      const result = clientSchema.parse({
        email: 'client@example.com',
        password: 'password123',
        fullName: 'Client Name',
        company: 'Client Corp',
      })
      expect(result.email).toBe('client@example.com')
    })
  })

  describe('missionReportSchema', () => {
    it('should validate valid mission report data', () => {
      const result = missionReportSchema.parse({
        observations: 'These are observations with more than 10 characters',
        results: 'These are results with more than 10 characters',
        findings: 'Optional findings',
        notes: 'Optional notes',
        photos: [
          { path: '/path/to/photo.jpg', name: 'photo.jpg', url: 'https://example.com/photo.jpg' },
        ],
      })
      expect(result.observations).toBe('These are observations with more than 10 characters')
    })

    it('should reject short observations', () => {
      expect(() =>
        missionReportSchema.parse({
          observations: 'Short',
          results: 'Valid results with more than 10 characters',
        })
      ).toThrow()
    })

    it('should reject short results', () => {
      expect(() =>
        missionReportSchema.parse({
          observations: 'Valid observations with more than 10 characters',
          results: 'Short',
        })
      ).toThrow()
    })
  })
})
