// backend/src/modules/users/entities/user.entity.ts
import { UserRole, TokenType } from '../../../shared/types/user.types';

// Define interfaces for related entities (or import them if they exist)
interface Token {
  id: string;
  userId: string;
  token: string;
  type: TokenType;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}

interface Address {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Cart {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Vendor {
  id: string;
  userId: string;
  storeName: string;
  storeSlug: string;
  description?: string;
  logo?: string;
  banner?: string;
  rating: number;
  totalReviews: number;
  isVerified: boolean;
  isActive: boolean;
  commissionRate: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  vendorId: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  shippingAddressId: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProductReview {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  title?: string;
  comment: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UserEntity {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  isEmailVerified: boolean;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Optional relations (commented out since they might not be needed for the entity)
  // tokens?: Token[];
  // addresses?: Address[];
  // cart?: Cart;
  // vendor?: Vendor;
  // orders?: Order[];
  // reviews?: ProductReview[];
}