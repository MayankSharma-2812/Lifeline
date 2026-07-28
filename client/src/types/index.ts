export type Role = 'requester' | 'donor';

export type BloodGroup = 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-';

export type Urgency = 'critical' | 'high' | 'moderate';

export type RequestStatus =
  | 'pending'
  | 'matched'
  | 'reserved'
  | 'confirmed'
  | 'expired'
  | 'escalated'
  | 'cancelled';

export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  location?: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };
}

export interface DonorProfile {
  _id: string;
  userId: string;
  bloodGroup: BloodGroup;
  status: 'available' | 'reserved' | 'on_cooldown';
  isAvailable: boolean;
  reliabilityScore: number;
  lastDonationDate?: string;
}

export interface Candidate {
  donorProfileId: string;
  userId: string;
  name: string;
  distanceMetres: number;
  bloodGroup: BloodGroup;
  reliabilityScore: number;
  status: string;
  explanation?: string;
}

export interface EmergencyRequest {
  _id: string;
  requesterId: string;
  rawText: string;
  parsed: {
    bloodGroup: BloodGroup;
    urgency: Urgency;
    source?: 'ai' | 'fallback';
  };
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  status: RequestStatus;
  matchedCandidateIds: string[];
  currentLockKey?: string | null;
  createdAt: string;
}
