import { pgTable, text, serial, integer, boolean, real, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Available progression schemes
export const progressionSchemes = ["STS", "Double Progression", "RPT Top-Set", "RPT Individual"] as const;
export type ProgressionScheme = typeof progressionSchemes[number];

// Unit conversion constant
export const KG_TO_LB = 2.20462;

// Equipment definitions
export const predefinedEquipment = {
  Barbell: { name: "Barbell", startingWeight: 20, increment: 2.5, units: "kg" },
  Dumbbell: { name: "Dumbbell", startingWeight: 2.5, increment: 2.5, units: "kg" },
  Cables: { name: "Cables", startingWeight: 25, increment: 15, units: "kg" },
} as const;

// Common parameters for all progression schemes
const commonParameters = {
  restBetweenSets: z.number().min(0),
  restBetweenExercises: z.number().min(0),
};

// Flexible timestamp validation for ISO 8601 strings
const timestampSchema = z.string().datetime({
  message: "Invalid timestamp format. Must be an ISO 8601 datetime string.",
});

// Progression Parameters Schemas
const stsParameters = z.object({
  scheme: z.literal("STS"),
  minSets: z.number().min(1),
  maxSets: z.number().min(1),
  minReps: z.number().min(1),
  maxReps: z.number().min(1),
  ...commonParameters,
});

const doubleProgressionParameters = z.object({
  scheme: z.literal("Double Progression"),
  targetSets: z.number().min(1),
  minReps: z.number().min(1),
  maxReps: z.number().min(1),
  ...commonParameters,
});

const rptTopSetParameters = z.object({
  scheme: z.literal("RPT Top-Set"),
  sets: z.number().min(1),
  targetReps: z.number().min(1),
  dropPercent: z.number().min(0).max(100),
  ...commonParameters,
});

const rptIndividualParameters = z.object({
  scheme: z.literal("RPT Individual"),
  sets: z.number().min(1),
  targetReps: z.number().min(1),
  dropPercent: z.number().min(0).max(100),
  ...commonParameters,
});

// Default progression parameters
export const defaultProgressionParameters = {
  "STS": { scheme: "STS" as const, minSets: 3, maxSets: 4, minReps: 6, maxReps: 8, restBetweenSets: 90, restBetweenExercises: 180 },
  "Double Progression": { scheme: "Double Progression" as const, targetSets: 3, minReps: 8, maxReps: 12, restBetweenSets: 90, restBetweenExercises: 180 },
  "RPT Top-Set": { scheme: "RPT Top-Set" as const, sets: 3, targetReps: 6, dropPercent: 10, restBetweenSets: 90, restBetweenExercises: 180 },
  "RPT Individual": { scheme: "RPT Individual" as const, sets: 3, targetReps: 6, dropPercent: 10, restBetweenSets: 90, restBetweenExercises: 180 },
} as const;

// Workout Exercise Schema
export const workoutExerciseSchema = z.object({
  exerciseId: z.number(),
  parameters: z.discriminatedUnion("scheme", [
    stsParameters,
    doubleProgressionParameters,
    rptTopSetParameters,
    rptIndividualParameters,
  ]),
});

// Database tables with indexes
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  preferredUnits: text("preferred_units", { enum: ["kg", "lb"] }).default("kg").notNull(),
  age: integer("age"),
  weight: real("weight"),
  goals: text("goals"),
}, (table) => ({
  emailIdx: index("email_idx").on(table.email),
}));

export const exercises = pgTable("exercises", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  equipmentName: text("equipment_name").notNull(),
  startingWeight: real("starting_weight").notNull(),
  increment: real("increment").notNull(),
  units: text("units", { enum: ["kg", "lb"] }).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
}));

export const workoutDays = pgTable("workout_days", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  exercises: jsonb("exercises").notNull().$type<z.infer<typeof workoutExerciseSchema>[]>(),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
}));

export type WorkoutSet = {
  exerciseId: number;
  sets: Array<{
    reps: number;
    weight: number;
    timestamp: string | null; // Allow null for uncompleted sets
  }>;
  extraSetReps?: number;
  oneRm?: number;
};

export const workoutLogs = pgTable("workout_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  workoutDayId: integer("workout_day_id").references(() => workoutDays.id),
  date: timestamp("date").notNull(),
  sets: jsonb("sets").notNull().$type<WorkoutSet[]>(),
  isComplete: boolean("is_complete").default(false).notNull(),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
  workoutDayIdIdx: index("workout_day_id_idx").on(table.workoutDayId),
  dateIdx: index("date_idx").on(table.date),
}));

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  preferredUnits: true,
  age: true,
  weight: true,
});

export const insertExerciseSchema = createInsertSchema(exercises).omit({ id: true });

export const insertWorkoutDaySchema = createInsertSchema(workoutDays)
  .omit({ id: true })
  .extend({
    exercises: z.array(workoutExerciseSchema),
  });

export const insertWorkoutLogSchema = createInsertSchema(workoutLogs)
  .omit({ id: true })
  .extend({
    date: timestampSchema, // Expect ISO 8601 string
    sets: z.array(z.object({
      exerciseId: z.number(),
      sets: z.array(z.object({
        reps: z.number(),
        weight: z.number(),
        timestamp: timestampSchema.nullable(), // Allow null for uncompleted sets
      })),
      extraSetReps: z.number().optional(),
      oneRm: z.number().optional(),
    })),
  });

// TypeScript types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Exercise = typeof exercises.$inferSelect;
export type InsertExercise = z.infer<typeof insertExerciseSchema>;

export type WorkoutDay = typeof workoutDays.$inferSelect;
export type InsertWorkoutDay = z.infer<typeof insertWorkoutDaySchema>;

export type WorkoutLog = {
  id?: number;
  userId?: number;
  workoutDayId: number;
  date: string; // ISO 8601 string
  sets: WorkoutSet[];
  isComplete?: boolean;
};
export type InsertWorkoutLog = z.infer<typeof insertWorkoutLogSchema>;

export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>;
export type STSParameters = z.infer<typeof stsParameters>;
export type DoubleProgressionParameters = z.infer<typeof doubleProgressionParameters>;
export type RPTTopSetParameters = z.infer<typeof rptTopSetParameters>;
export type RPTIndividualParameters = z.infer<typeof rptIndividualParameters>;