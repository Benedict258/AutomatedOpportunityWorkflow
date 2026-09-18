import { BaseEntity } from '../types';

export interface User extends BaseEntity {
  email: string;
  name: string;
}
