import { TripStatus } from '@/constants/trip-status';

export type StopType = 'LOADING' | 'UNLOADING' | 'WAYPOINT';
export type TruckStatus = 'AVAILABLE' | 'ON_TRIP' | 'REPAIR';

export interface TruckNote {
  id: string;
  truckId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string | null; role: string };
}

export interface TripStop {
  id: string;
  tripId: string;
  type: StopType;
  order: number;
  name: string | null; // мітка для WAYPOINT (напр. "Кастомс")
  address: string | null;
  ref: string | null;
  coords: string | null;
  windowDate: string | null; // "YYYY-MM-DD"
  windowStart: string | null; // "HH:mm"
  windowEnd: string | null; // "HH:mm"
}

export interface TripDocument {
  id: string;
  tripId: string;
  fileName: string;
  fileUrl: string;
  fileType: 'PHOTO' | 'DOCUMENT';
  uploadedBy: string;
  createdAt: string;
}

export interface Trip {
  id: string;
  title: string;
  status: TripStatus;
  notes: string | null;
  orderNumber: string | null;
  createdAt: string;
  updatedAt: string;
  driver: { id: string; firstName: string; lastName: string | null; phone: string | null } | null;
  // managerId decides who may delete the trip: the truck's current
  // manager, or a teamlead. Sent by the API so the UI need not ask.
  truck: { id: string; plate: string; managerId: string | null } | null;
  manager: { id: string; firstName: string; lastName: string | null };
  stops: TripStop[];
  documents: TripDocument[];
}
