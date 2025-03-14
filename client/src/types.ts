import { 
  User as BaseUser, 
  Exercise as BaseExercise,
  WorkoutDay as BaseWorkoutDay,
  WorkoutLog as BaseWorkoutLog,
  InsertUser,
  InsertExercise as BaseInsertExercise,
  InsertWorkoutDay,
  InsertWorkoutLog,
} from "@shared/schema";
import { z } from "zod";

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

// Constants
export const KG_TO_LB = 2.20462;

// Equipment Types
interface EquipmentType {
  name: string;
  startingWeight: number;
  increment: number;
}

export const predefinedEquipment: Record<string, EquipmentType> = {
  Barbell: {
    name: "Barbell",
    startingWeight: 20, // Standard Olympic barbell weight in kg
    increment: 2.5,     // Standard plate increment in kg
  },
  Dumbbell: {
    name: "Dumbbell",
    startingWeight: 5,  // Starting with light dumbbells
    increment: 1,       // Smaller increments for dumbbells
  },
  "Kettlebell": {
    name: "Kettlebell",
    startingWeight: 8,  // Standard starting kettlebell weight
    increment: 4,       // Standard kettlebell weight jumps
  },
  "Cable Machine": {
    name: "Cable Machine",
    startingWeight: 5,  // Light starting weight
    increment: 2.5,     // Standard cable weight increments
  },
  "Smith Machine": {
    name: "Smith Machine",
    startingWeight: 7,  // Bar weight of typical Smith machine
    increment: 2.5,     // Standard plate increment
  }
};

// Exercise Schema
export const insertExerciseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  equipmentName: z.string().min(1, "Equipment is required"),
  startingWeight: z.number().min(0, "Starting weight must be positive"),
  increment: z.number().min(0, "Increment must be positive"),
  units: z.enum(["kg", "lb"]),
  isArchived: z.boolean().default(false)
});

export type InsertExercise = z.infer<typeof insertExerciseSchema>;

// Re-export other types that don't need extension
export type {
  InsertUser,
  BaseInsertExercise,
  InsertWorkoutDay,
  InsertWorkoutLog,
};