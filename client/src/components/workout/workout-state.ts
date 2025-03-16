export interface WorkoutState {
  isWorkoutActive: boolean;
  currentSet: number;
  loggedSets: Array<{
    reps: number;
    weight: number;
    timestamp: string;
    isFailure?: boolean;
    exceededMax?: boolean;
  }>;
  restTimer: number | null;
  selectedSuggestion: any | null;
  extraSetReps: number | null;
  workoutLogId: number | null;
  isEditing: boolean;
  editWeight: number | null;
  editReps: number | null;
  showRepsInput: boolean;
}

export const initialWorkoutState: WorkoutState = {
  isWorkoutActive: false,
  currentSet: 0,
  loggedSets: [],
  restTimer: null,
  selectedSuggestion: null,
  extraSetReps: null,
  workoutLogId: null,
  isEditing: false,
  editWeight: null,
  editReps: null,
  showRepsInput: false
};
