import { pgTable, text, serial, integer, boolean, real, jsonb, timestamp, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User model with profile
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  age: integer("age"),
  weight: real("weight"),
  preferredUnits: text("preferred_units", { enum: ["kg", "lb"] }).default("kg").notNull(),
  goals: text("goals"),
});

// Equipment types
export const equipmentTypes = pgTable("equipment_types", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  defaultWeight: real("default_weight").notNull(),
  increment: real("increment").notNull(),
  units: text("units", { enum: ["kg", "lb"] }).notNull(),
  isCustom: boolean("is_custom").default(false).notNull(),
});

// Exercises
export const exercises = pgTable("exercises", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  equipmentId: integer("equipment_id").references(() => equipmentTypes.id),
  isArchived: boolean("is_archived").default(false).notNull(),
});

// Workout Days
export const workoutDays = pgTable("workout_days", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  exercises: jsonb("exercises").notNull(), // Array of {exerciseId, scheme, restBetweenSets, restBetweenExercises}
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

export const insertEquipmentTypeSchema = createInsertSchema(equipmentTypes).omit({
  id: true,
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

export type EquipmentType = typeof equipmentTypes.$inferSelect;
export type InsertEquipmentType = z.infer<typeof insertEquipmentTypeSchema>;

export type Exercise = typeof exercises.$inferSelect;
export type InsertExercise = z.infer<typeof insertExerciseSchema>;

export type WorkoutDay = typeof workoutDays.$inferSelect;
export type InsertWorkoutDay = z.infer<typeof insertWorkoutDaySchema>;

export type WorkoutLog = typeof workoutLogs.$inferSelect;
export type InsertWorkoutLog = z.infer<typeof insertWorkoutLogSchema>;

// Progression Scheme Types
export const progressionSchemes = ["STS", "Double Progression", "RPT Top-Set", "RPT Individual"] as const;
export type ProgressionScheme = typeof progressionSchemes[number];
