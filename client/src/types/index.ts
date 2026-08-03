/**
 * @module types/index.ts
 * @description Centralized TypeScript definitions for the LifeLine application.
 */

export type Role = 'requester' | 'donor';

export type BloodGroup = 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-';

export type Urgency = 'critical' | 'high' | 'moderate';

/**
 * Represents the lifecycle state of an emergency blood request.
 */
export type RequestStatus =
  | 'pending'
  | 'matched'
  | 'reserved'
  | 'confirmed'
  | 'expired'
  | 'escalated'
  | 'cancelled';

/**
 * Standard user profile payload returned from authentication endpoints.
 */
export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  location?: {
    type: string;
    coordinates: [number, number]; // GeoJSON format: [longitude, latitude]
  };
}

/**
 * Donor-specific profile data containing availability and reliability metrics.
 */
export interface DonorProfile {
  _id: string;
  userId: string;
  bloodGroup: BloodGroup;
  status: 'available' | 'reserved' | 'on_cooldown';
  isAvailable: boolean;
  reliabilityScore: number;
  lastDonationDate?: string;
}

/**
 * A matched donor candidate proposed for an emergency request.
 */
export interface Candidate {
  donorProfileId: string;
  userId: string;
  name: string;
  distanceMetres: number;
  bloodGroup: BloodGroup;
  reliabilityScore: number;
  status: string;
  explanation?: string; // Optional reasoning provided by the AI match engine
}

/**
 * The core entity representing a user's request for emergency blood.
 */
export interface EmergencyRequest {
  _id: string;
  requesterId: string;
  rawText: string;
  parsed: {
    bloodGroup: BloodGroup;
    urgency: Urgency;
    source?: 'ai' | 'fallback'; // Indicates whether NLP successfully processed the request
  };
  location: {
    type: 'Point';
    coordinates: [number, number]; // GeoJSON format: [longitude, latitude]
  };
  status: RequestStatus;
  matchedCandidateIds: string[];
  currentLockKey?: string | null;
  createdAt: string;
}
