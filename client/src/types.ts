import { 
  User as BaseUser, 
  Exercise as BaseExercise,
  WorkoutDay as BaseWorkoutDay,
  WorkoutLog as BaseWorkoutLog,
} from "@shared/schema";

// Extend base types with any client-specific additions
export interface User extends BaseUser {
  // Add any client-specific user properties here
}

export interface Exercise extends BaseExercise {
  // Add any client-specific exercise properties here
  equipmentName?: string;
  units?: string;
}

export interface WorkoutDay extends BaseWorkoutDay {
  // Add any client-specific workout day properties here
}

export interface WorkoutLog extends BaseWorkoutLog {
  // Add any client-specific workout log properties here
}

// Re-export other types that don't need extension
export type {
  InsertUser,
  InsertExercise,
  InsertWorkoutDay,
  InsertWorkoutLog,
} from "@shared/schema";