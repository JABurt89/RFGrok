import { WorkoutState, initialWorkoutState } from './workout-state';
import { WorkoutAction } from './workout-actions';

export function workoutReducer(state: WorkoutState, action: WorkoutAction): WorkoutState {
  switch (action.type) {
    case 'START_WORKOUT':
      return {
        ...state,
        isWorkoutActive: true,
        selectedSuggestion: action.payload.suggestion,
        currentSet: 0,
        loggedSets: []
      };
      
    case 'COMPLETE_SET':
      return {
        ...state,
        loggedSets: [...state.loggedSets, {
          weight: action.payload.weight,
          reps: action.payload.reps,
          timestamp: new Date().toISOString(),
          isFailure: false
        }],
        currentSet: state.currentSet + 1,
        restTimer: state.currentSet + 1 >= state.selectedSuggestion?.sets 
          ? null 
          : state.selectedSuggestion?.parameters?.restBetweenSets || 60,
        isEditing: false,
        editWeight: null,
        editReps: null
      };
      
    case 'FAIL_SET':
      return {
        ...state,
        loggedSets: [...state.loggedSets, {
          weight: action.payload.weight,
          reps: action.payload.completedReps,
          timestamp: new Date().toISOString(),
          isFailure: true
        }],
        currentSet: state.currentSet + 1,
        restTimer: state.selectedSuggestion?.parameters?.restBetweenSets || 60,
        showRepsInput: false
      };
      
    case 'LOG_REPS':
      return {
        ...state,
        loggedSets: [...state.loggedSets, {
          weight: state.editWeight ?? state.selectedSuggestion?.weight,
          reps: action.payload.reps,
          timestamp: new Date().toISOString(),
          isFailure: false,
          exceededMax: action.payload.exceededMax
        }],
        currentSet: state.currentSet + 1,
        restTimer: state.currentSet + 1 >= state.selectedSuggestion?.sets 
          ? null 
          : state.selectedSuggestion?.parameters?.restBetweenSets || 60,
        showRepsInput: false,
        isEditing: false,
        editWeight: null,
        editReps: null
      };
      
    case 'START_EDITING':
      return {
        ...state,
        isEditing: true,
        editWeight: state.selectedSuggestion?.weight,
        editReps: state.selectedSuggestion?.reps
      };
      
    case 'CANCEL_EDITING':
      return {
        ...state,
        isEditing: false,
        editWeight: null,
        editReps: null
      };
      
    case 'UPDATE_EDIT_WEIGHT':
      return {
        ...state,
        editWeight: action.payload
      };
      
    case 'UPDATE_EDIT_REPS':
      return {
        ...state,
        editReps: action.payload
      };
      
    case 'TOGGLE_REPS_INPUT':
      return {
        ...state,
        showRepsInput: action.payload
      };
      
    case 'SET_WORKOUT_LOG_ID':
      return {
        ...state,
        workoutLogId: action.payload
      };
      
    case 'UPDATE_REST_TIMER':
      return {
        ...state,
        restTimer: action.payload
      };
      
    case 'TICK_REST_TIMER':
      if (state.restTimer === null || state.restTimer <= 0) return state;
      
      return {
        ...state,
        restTimer: state.restTimer - 1
      };
      
    case 'LOG_EXTRA_SET':
      return {
        ...state,
        extraSetReps: action.payload
      };
      
    case 'RESET_WORKOUT':
      return initialWorkoutState;
      
    default:
      return state;
  }
}
