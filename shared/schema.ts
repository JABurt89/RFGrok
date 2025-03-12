import { pgTable, text, serial, integer, boolean, real, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Available progression schemes
export const progressionSchemes = ["STS", "Double Progression", "RPT Top-Set", "RPT Individual"] as const;
export type ProgressionScheme = typeof progressionSchemes[number];

// Database tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  preferredUnits: text("preferred_units", { enum: ["kg", "lb"] }).default("kg").notNull(),
  goals: text("goals"),
});

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

export const workoutDays = pgTable("workout_days", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  exercises: jsonb("exercises").notNull().$type<WorkoutExercise[]>(),
});

export const workoutLogs = pgTable("workout_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  workoutDayId: integer("workout_day_id").references(() => workoutDays.id),
  date: timestamp("date").notNull(),
  sets: jsonb("sets").notNull().$type<{
    exerciseId: number;
    sets: Array<{
      reps: number;
      weight: number;
      timestamp: string;
    }>;
    extraSetReps?: number;
  }>(),
  isComplete: boolean("is_complete").default(false).notNull(),
});

// Progression Parameters Schemas
const commonParameters = {
  restBetweenSets: z.number().min(0),
  restBetweenExercises: z.number().min(0),
};

const stsParameters = z.object({
  scheme: z.literal("STS"),
  minSets: z.number().min(1),
  maxSets: z.number().min(1),
  minReps: z.number().min(1),
  maxReps: z.number().min(1),
  restBetweenSets: z.number().min(0),
  restBetweenExercises: z.number().min(0),
}).strict();

const doubleProgressionParameters = z.object({
  scheme: z.literal("Double Progression"),
  targetSets: z.number().min(1),
  minReps: z.number().min(1),
  maxReps: z.number().min(1),
  restBetweenSets: z.number().min(0),
  restBetweenExercises: z.number().min(0),
}).strict();

const rptParameters = z.object({
  scheme: z.union([z.literal("RPT Top-Set"), z.literal("RPT Individual")]),
  sets: z.number().min(1),
  targetReps: z.number().min(1),
  dropPercent: z.number().min(0).max(100),
  restBetweenSets: z.number().min(0),
  restBetweenExercises: z.number().min(0),
}).strict();

// Workout Exercise Schema with discriminatedUnion
const workoutExerciseSchema = z.object({
  exerciseId: z.number(),
  parameters: z.discriminatedUnion("scheme", [
    stsParameters,
    doubleProgressionParameters,
    rptParameters,
  ]),
}).strict();

// Default progression parameters
export const defaultParameters = {
  STS: {
    scheme: "STS" as const,
    minSets: 3,
    maxSets: 3,
    minReps: 6,
    maxReps: 8,
    restBetweenSets: 90,
    restBetweenExercises: 180,
  },
  "Double Progression": {
    scheme: "Double Progression" as const,
    targetSets: 3,
    minReps: 8,
    maxReps: 12,
    restBetweenSets: 90,
    restBetweenExercises: 180,
  },
  "RPT Top-Set": {
    scheme: "RPT Top-Set" as const,
    sets: 3,
    targetReps: 6,
    dropPercent: 10,
    restBetweenSets: 90,
    restBetweenExercises: 180,
  },
  "RPT Individual": {
    scheme: "RPT Individual" as const,
    sets: 3,
    targetReps: 6,
    dropPercent: 10,
    restBetweenSets: 90,
    restBetweenExercises: 180,
  },
} as const;

// Equipment definitions
export const predefinedEquipment = {
  Barbell: {
    name: "Barbell",
    startingWeight: 20,
    increment: 2.5,
    units: "kg",
  },
  Dumbbell: {
    name: "Dumbbell",
    startingWeight: 2.5,
    increment: 1,
    units: "kg",
  },
} as const;

// Unit conversion constant
export const KG_TO_LB = 2.20462;

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  preferredUnits: true,
});

export const insertExerciseSchema = createInsertSchema(exercises).omit({
  id: true,
});

export const insertWorkoutDaySchema = createInsertSchema(workoutDays)
  .omit({ id: true })
  .extend({
    exercises: z.array(workoutExerciseSchema),
  });

export const insertWorkoutLogSchema = createInsertSchema(workoutLogs).omit({
  id: true,
});

// TypeScript types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Exercise = typeof exercises.$inferSelect;
export type InsertExercise = z.infer<typeof insertExerciseSchema>;

export type WorkoutDay = typeof workoutDays.$inferSelect;
export type InsertWorkoutDay = z.infer<typeof insertWorkoutDaySchema>;

export type WorkoutLog = typeof workoutLogs.$inferSelect;
export type InsertWorkoutLog = z.infer<typeof insertWorkoutLogSchema>;

export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>;
export type STSParameters = z.infer<typeof stsParameters>;
export type DoubleProgressionParameters = z.infer<typeof doubleProgressionParameters>;
export type RPTParameters = z.infer<typeof rptParameters>;