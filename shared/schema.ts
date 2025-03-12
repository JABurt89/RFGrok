import { pgTable, text, serial, integer, boolean, real, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User model with profile
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  preferredUnits: text("preferred_units", { enum: ["kg", "lb"] }).default("kg").notNull(),
  goals: text("goals"),
});

// Exercise model
export const exercises = pgTable("exercises", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  equipmentName: text("equipment_name").notNull(),
  startingWeight: real("starting_weight").notNull(),
  increment: real("increment").notNull(),
  units: text("units", { enum: ["kg", "lb"] }).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
});

// Workout Days
export const workoutDays = pgTable("workout_days", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  exercises: jsonb("exercises").notNull().$type<WorkoutExercise[]>(),
});

// Workout Logs
export const workoutLogs = pgTable("workout_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  workoutDayId: integer("workout_day_id").references(() => workoutDays.id),
  date: timestamp("date").notNull(),
  sets: jsonb("sets").notNull(), // Array of {exerciseId, reps, weight, timestamp}
  isComplete: boolean("is_complete").default(false).notNull(),
  oneRm: real("one_rm"),
  extraSetReps: integer("extra_set_reps"),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  preferredUnits: true,
});

export const insertExerciseSchema = createInsertSchema(exercises).omit({
  id: true,
});

export const insertWorkoutDaySchema = createInsertSchema(workoutDays).omit({
  id: true,
});

export const insertWorkoutLogSchema = createInsertSchema(workoutLogs).omit({
  id: true,
});


// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Exercise = typeof exercises.$inferSelect;
export type InsertExercise = z.infer<typeof insertExerciseSchema>;

export type WorkoutDay = typeof workoutDays.$inferSelect;
export type InsertWorkoutDay = z.infer<typeof insertWorkoutDaySchema>;

export type WorkoutLog = typeof workoutLogs.$inferSelect;
export type InsertWorkoutLog = z.infer<typeof insertWorkoutLogSchema>;

// Progression Scheme Types with parameters
export type STSParameters = {
  minSets: number;
  maxSets: number; // Extra set will be one above this
  minReps: number;
  maxReps: number;
  restBetweenSets: number;
  restBetweenExercises: number;
};

export type DoubleProgressionParameters = {
  targetSets: number;
  minReps: number;
  maxReps: number;
  restBetweenSets: number;
  restBetweenExercises: number;
};

export type RPTParameters = {
  sets: number;
  targetReps: number;
  dropPercent: number; // e.g., 10 for 10% drop per set
  restBetweenSets: number;
  restBetweenExercises: number;
};

export type WorkoutExercise = {
  exerciseId: number;
  scheme: ProgressionScheme;
  parameters: STSParameters | DoubleProgressionParameters | RPTParameters;
};

// Progression Scheme Types
export const progressionSchemes = ["STS", "Double Progression", "RPT Top-Set", "RPT Individual"] as const;
export type ProgressionScheme = typeof progressionSchemes[number];

// Predefined Equipment
export const predefinedEquipment = {
  Barbell: {
    name: "Barbell",
    startingWeight: 20, // kg
    increment: 2.5, // kg
    units: "kg"
  },
  Dumbbell: {
    name: "Dumbbell",
    startingWeight: 2.5, // kg
    increment: 1, // kg
    units: "kg"
  },
} as const;

// Unit conversion constant
export const KG_TO_LB = 2.20462;

// Default progression parameters
export const defaultProgressionParameters = {
  STS: {
    minSets: 3,
    maxSets: 3, // Extra set will be the 4th set if achieved
    minReps: 6,
    maxReps: 8,
    restBetweenSets: 90,
    restBetweenExercises: 180,
  },
  "Double Progression": {
    targetSets: 3,
    minReps: 8,
    maxReps: 12,
    restBetweenSets: 90,
    restBetweenExercises: 180,
  },
  "RPT Top-Set": {
    sets: 3,
    targetReps: 6,
    dropPercent: 10,
    restBetweenSets: 90,
    restBetweenExercises: 180,
  },
  "RPT Individual": {
    sets: 3,
    targetReps: 6,
    dropPercent: 10,
    restBetweenSets: 90,
    restBetweenExercises: 180,
  },
} as const;