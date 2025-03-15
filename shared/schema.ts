import { pgTable, text, serial, integer, boolean, real, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Available progression schemes
export const progressionSchemes = ["STS", "Double Progression", "RPT Top-Set", "RPT Individual"] as const;
export type ProgressionScheme = typeof progressionSchemes[number];

// Unit conversion constant
export const KG_TO_LB = 2.20462;

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

// Common parameters for all progression schemes
const commonParameters = {
  restBetweenSets: z.number().min(0),
  restBetweenExercises: z.number().min(0),
};

// Progression Parameters Schemas
const stsParameters = z.object({
  scheme: z.literal("STS"),
  minSets: z.number().min(1),
  maxSets: z.number().min(1),
  minReps: z.number().min(1),
  maxReps: z.number().min(1),
  ...commonParameters,
}).strict();

const doubleProgressionParameters = z.object({
  scheme: z.literal("Double Progression"),
  targetSets: z.number().min(1),
  minReps: z.number().min(1),
  maxReps: z.number().min(1),
  ...commonParameters,
}).strict();

const rptTopSetParameters = z.object({
  scheme: z.literal("RPT Top-Set"),
  sets: z.number().min(2, "At least 2 sets required"),
  minReps: z.number().min(1),
  maxReps: z.number().min(1),
  dropPercentages: z.array(z.number().min(0).max(100)),
  ...commonParameters,
}).strict();

const rptIndividualParameters = z.object({
  scheme: z.literal("RPT Individual"),
  sets: z.number().min(1, "At least 1 set required"),
  setConfigs: z.array(z.object({
    min: z.number().min(1),
    max: z.number().min(1),
  })),
  ...commonParameters,
}).strict();

// Default progression parameters
export const defaultProgressionParameters = {
  "STS": {
    scheme: "STS" as const,
    minSets: 3,
    maxSets: 4,
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
    minReps: 6,
    maxReps: 8,
    dropPercentages: [0, 10, 10],
    restBetweenSets: 180,
    restBetweenExercises: 240,
  },
  "RPT Individual": {
    scheme: "RPT Individual" as const,
    sets: 3,
    setConfigs: [
      { min: 5, max: 7 },
      { min: 6, max: 8 },
      { min: 7, max: 9 }
    ],
    restBetweenSets: 180,
    restBetweenExercises: 240,
  },
} as const;

// Workout Exercise Schema with corrected discriminated union
const workoutExerciseSchema = z.object({
  exerciseId: z.number(),
  parameters: z.discriminatedUnion("scheme", [
    stsParameters,
    doubleProgressionParameters,
    rptTopSetParameters,
    rptIndividualParameters,
  ]),
}).strict();

// Database tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  preferredUnits: text("preferred_units", { enum: ["kg", "lb"] }).default("kg").notNull(),
  age: integer("age"),
  weight: real("weight"),
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
  date: timestamp("date").notNull(),
  sets: jsonb("sets").notNull().$type<{
    exerciseId: number;
    sets: Array<{
      reps: number;
      weight: number;
      timestamp: string; // ISO 8601 timestamp for rest time tracking
    }>;
    extraSetReps?: number; // For STS progression tracking
    oneRm?: number; // Calculated 1RM for the exercise
    parameters: STSParameters | DoubleProgressionParameters | RPTTopSetParameters | RPTIndividualParameters;
  }>(),
  isComplete: boolean("is_complete").default(false).notNull(),
});


// Insert Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  preferredUnits: true,
  age: true,
  weight: true,
});

export const insertExerciseSchema = createInsertSchema(exercises).omit({
  id: true,
});

export const insertWorkoutDaySchema = createInsertSchema(workoutDays)
  .omit({ id: true })
  .extend({
    exercises: z.array(workoutExerciseSchema),
  });

export const insertWorkoutLogSchema = createInsertSchema(workoutLogs)
  .omit({ id: true })
  .extend({
    date: z.union([
      z.date(),
      z.string().refine(val => !isNaN(new Date(val).getTime()), {
        message: "Invalid date string"
      })
    ]),
    sets: z.array(z.object({
      exerciseId: z.number(),
      sets: z.array(z.object({
        reps: z.number(),
        weight: z.number(),
        timestamp: z.union([
          z.date(),
          z.string().refine(val => !isNaN(new Date(val).getTime()), {
            message: "Invalid timestamp string"
          })
        ])
      })),
      extraSetReps: z.number().optional(),
      oneRm: z.number().optional(),
      parameters: z.discriminatedUnion("scheme", [
        stsParameters,
        doubleProgressionParameters,
        rptTopSetParameters,
        rptIndividualParameters,
      ])
    }))
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
  date: Date | string;
  sets: {
    exerciseId: number;
    sets: Array<{
      reps: number;
      weight: number;
      timestamp: string;
    }>;
    extraSetReps?: number;
    oneRm?: number;
    parameters: STSParameters | DoubleProgressionParameters | RPTTopSetParameters | RPTIndividualParameters;
  }[];
  isComplete?: boolean;
};
export type InsertWorkoutLog = z.infer<typeof insertWorkoutLogSchema>;

export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>;
export type STSParameters = z.infer<typeof stsParameters>;
export type DoubleProgressionParameters = z.infer<typeof doubleProgressionParameters>;
export type RPTTopSetParameters = z.infer<typeof rptTopSetParameters>;
export type RPTIndividualParameters = z.infer<typeof rptIndividualParameters>;