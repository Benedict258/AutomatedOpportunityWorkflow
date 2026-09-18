import { BaseEntity, EntityId } from '../types';
import { NotificationStatus, NotificationChannel, DeliveryStatus } from '../enums';

export interface Notification extends BaseEntity {
  userId: EntityId;
  type: string;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: EntityId;
  scheduledAt?: string;
  sentAt?: string;
  status: NotificationStatus;
}

export interface NotificationHistory {
  id: string;
  notificationId: EntityId;
  userId: EntityId;
  channel: NotificationChannel;
  sentAt?: string;
  deliveryStatus: DeliveryStatus;
  errorInfo?: string;
}
