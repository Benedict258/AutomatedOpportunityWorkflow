export type EntityId = string;

export type Timestamp = string;

export interface BaseEntity {
  id: EntityId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
