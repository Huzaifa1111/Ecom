import { IsString } from 'class-validator';

export class VerifyEmailDto {
  @IsString({ message: 'Token is required' })
  token: string;
}