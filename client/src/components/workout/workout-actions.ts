export type WorkoutAction =
  | { type: 'START_WORKOUT'; payload: { suggestion: any } }
  | { type: 'COMPLETE_SET'; payload: { weight: number; reps: number } }
  | { type: 'FAIL_SET'; payload: { weight: number; completedReps: number } }
  | { type: 'LOG_REPS'; payload: { reps: number; exceededMax?: boolean } }
  | { type: 'START_EDITING' }
  | { type: 'CANCEL_EDITING' }
  | { type: 'UPDATE_EDIT_WEIGHT'; payload: number }
  | { type: 'UPDATE_EDIT_REPS'; payload: number }
  | { type: 'TOGGLE_REPS_INPUT'; payload: boolean }
  | { type: 'SET_WORKOUT_LOG_ID'; payload: number }
  | { type: 'UPDATE_REST_TIMER'; payload: number | null }
  | { type: 'TICK_REST_TIMER' }
  | { type: 'LOG_EXTRA_SET'; payload: number }
  | { type: 'RESET_WORKOUT' };
