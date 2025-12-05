import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateFeedbackDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsEnum(['bug', 'feature', 'improvement', 'other'])
  type?: 'bug' | 'feature' | 'improvement' | 'other';
}

