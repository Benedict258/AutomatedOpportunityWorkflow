import { BaseEntity } from '../types';
import { SkillRelationType } from '../enums';

export interface Skill extends BaseEntity {
  name: string;
  normalizedName?: string;
  description?: string;
  category?: string;
}

export interface OpportunitySkill {
  id: string;
  opportunityId: string;
  skillId: string;
  relationType: SkillRelationType;
  proficiencyContext?: string;
}
