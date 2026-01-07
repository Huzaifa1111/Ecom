import { TokenType } from '../../../shared/types/user.types';

export class TokenEntity {
  id: string;
  userId: string;
  token: string;
  type: TokenType;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;

  constructor(partial: Partial<TokenEntity>) {
    Object.assign(this, partial);
  }
}