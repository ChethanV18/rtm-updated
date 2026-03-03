export type PhaseStatus = 'pending' | 'completed' | 'failed';
export type RequirementStatus = 'Not Started' | 'In Progress' | 'Complete';

export interface Requirement {
  id: string;
  description: string;
  dev: PhaseStatus;
  test: PhaseStatus;
  report: PhaseStatus;
  deploy: PhaseStatus;
  usage: PhaseStatus;
  remarks: string;
  status: RequirementStatus;
}
