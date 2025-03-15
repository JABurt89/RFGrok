import { User, InsertUser, Exercise, InsertExercise, WorkoutDay, InsertWorkoutDay, WorkoutLog, InsertWorkoutLog } from "@shared/schema";
import { db } from "./db";
import { users, exercises, workoutDays, workoutLogs } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { encrypt, decrypt } from "./utils";
import { STSProgression, DoubleProgression, RPTTopSetDependent, RPTIndividualProgression, type ProgressionSuggestion } from "@shared/progression";

const PgSession = connectPgSimple(session);

export class DatabaseStorage {
  private _sessionStore: session.Store | null = null;

  get sessionStore(): session.Store {
    if (!this._sessionStore) {
      console.log("[Storage] Initializing PostgreSQL session store");
      this._sessionStore = new PgSession({
        pool,
        tableName: "session",
        createTableIfMissing: true,
        errorLog: console.error
      });
    }
    return this._sessionStore;
  }

  async getWorkoutLogs(userId: number): Promise<WorkoutLog[]> {
    const logs = await db.select().from(workoutLogs).where(eq(workoutLogs.userId, userId));
    return logs.map(log => ({
      ...log,
      sets: typeof log.sets === 'string' ?
        JSON.parse(decrypt(log.sets)) :
        log.sets
    }));
  }

  async getUserWorkoutLogs(userId: number): Promise<WorkoutLog[]> {
    console.log("[Storage] Getting workout logs for user:", userId);
    const logs = await db.select()
        .from(workoutLogs)
        .where(and(eq(workoutLogs.userId, userId), eq(workoutLogs.isComplete, true)))
        .orderBy(workoutLogs.date, 'desc');

    console.log("[Storage] Raw logs from database:", logs.length);
    const parsedLogs = logs.map(log => ({
        ...log,
        sets: typeof log.sets === 'string' ? JSON.parse(decrypt(log.sets)) : log.sets
    }));
    console.log("[Storage] First parsed log sets:", parsedLogs.length > 0 ? JSON.stringify(parsedLogs[0].sets, null, 2) : "No logs");

    return parsedLogs;
  }

  async createWorkoutLog(insertWorkoutLog: InsertWorkoutLog): Promise<WorkoutLog> {
    console.log("[Storage] Creating workout log:", insertWorkoutLog);

    // Fetch the workout day to get progression schemes
    const [workoutDay] = await db
      .select()
      .from(workoutDays)
      .where(eq(workoutDays.id, insertWorkoutLog.workoutDayId));
    if (!workoutDay) throw new Error("Workout day not found");

    // Calculate 1RM for each exercise in sets
    const setsWith1RM = insertWorkoutLog.sets.map(setData => {
      const exerciseConfig = workoutDay.exercises.find(ex => ex.exerciseId === setData.exerciseId);
      if (!exerciseConfig) {
        console.warn(`[Storage] No exercise config found for exerciseId: ${setData.exerciseId}`);
        return setData; // Return unchanged if no config
      }

      let calculated1RM: number;
      switch (exerciseConfig.parameters.scheme) {
        case "STS":
          const stsProgression = new STSProgression();
          calculated1RM = stsProgression.calculate1RM(
            setData.sets.map(s => ({ reps: s.reps, weight: s.weight }))
          );
          break;
        case "Double Progression":
          calculated1RM = setData.sets[0]?.weight * (1 + 0.025 * setData.sets[0]?.reps) || 0;
          break;
        case "RPT Top-Set":
        case "RPT Individual":
          calculated1RM = setData.sets[0]?.weight * (1 + 0.025 * setData.sets[0]?.reps) || 0;
          break;
        default:
          calculated1RM = 0;
      }
      console.log(`[Storage] Calculated 1RM for exercise ${setData.exerciseId}: ${calculated1RM}`);
      return { ...setData, oneRm: calculated1RM };
    });

    const encryptedSets = encrypt(JSON.stringify(setsWith1RM));
    const [workoutLog] = await db
      .insert(workoutLogs)
      .values({
        ...insertWorkoutLog,
        sets: encryptedSets,
      })
      .returning();

    return {
      ...workoutLog,
      sets: typeof workoutLog.sets === "string" ? JSON.parse(decrypt(workoutLog.sets)) : workoutLog.sets,
    };
  }

  async updateWorkoutLog(id: number, updates: Partial<WorkoutLog>): Promise<WorkoutLog> {
    const updateData = { ...updates };

    if (updateData.sets) {
      const [workoutLog] = await db.select().from(workoutLogs).where(eq(workoutLogs.id, id));
      if (!workoutLog) throw new Error("Workout log not found");

      const [workoutDay] = await db
        .select()
        .from(workoutDays)
        .where(eq(workoutDays.id, workoutLog.workoutDayId));
      if (!workoutDay) throw new Error("Workout day not found");

      const setsWith1RM = updateData.sets.map(setData => {
        const exerciseConfig = workoutDay.exercises.find(ex => ex.exerciseId === setData.exerciseId);
        if (!exerciseConfig) return setData;

        let calculated1RM: number;
        switch (exerciseConfig.parameters.scheme) {
          case "STS":
            const stsProgression = new STSProgression();
            calculated1RM = stsProgression.calculate1RM(
              setData.sets.map(s => ({ reps: s.reps, weight: s.weight }))
            );
            break;
          case "Double Progression":
            calculated1RM = setData.sets[0]?.weight * (1 + 0.025 * setData.sets[0]?.reps) || 0;
            break;
          case "RPT Top-Set":
          case "RPT Individual":
            calculated1RM = setData.sets[0]?.weight * (1 + 0.025 * setData.sets[0]?.reps) || 0;
            break;
          default:
            calculated1RM = 0;
        }
        return { ...setData, oneRm: calculated1RM };
      });

      updateData.sets = encrypt(JSON.stringify(setsWith1RM));
    }

    console.log("[Storage] Updating workout log:", id, "with:", updateData);

    const [updated] = await db
      .update(workoutLogs)
      .set(updateData)
      .where(eq(workoutLogs.id, id))
      .returning();

    if (!updated) throw new Error("Workout log not found");

    return {
      ...updated,
      sets: typeof updated.sets === "string" ? JSON.parse(decrypt(updated.sets)) : updated.sets,
    };
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getExercises(userId: number): Promise<Exercise[]> {
    return db.select().from(exercises).where(eq(exercises.userId, userId));
  }

  async createExercise(insertExercise: InsertExercise): Promise<Exercise> {
    const [exercise] = await db.insert(exercises).values(insertExercise).returning();
    return exercise;
  }

  async updateExercise(id: number, exercise: Partial<Exercise>): Promise<Exercise> {
    const [updated] = await db
      .update(exercises)
      .set(exercise)
      .where(eq(exercises.id, id))
      .returning();
    if (!updated) throw new Error("Exercise not found");
    return updated;
  }

  async getWorkoutDays(userId: number | undefined): Promise<WorkoutDay[]> {
    if (userId === undefined){
      return db.select().from(workoutDays);
    }
    return db.select().from(workoutDays).where(eq(workoutDays.userId, userId));
  }

  async createWorkoutDay(insertWorkoutDay: InsertWorkoutDay): Promise<WorkoutDay> {
    const [workoutDay] = await db.insert(workoutDays).values(insertWorkoutDay).returning();
    return workoutDay;
  }

  async updateWorkoutDay(id: number, workoutDay: Partial<WorkoutDay>): Promise<WorkoutDay> {
    // Only update specified fields
    const updateData: Partial<WorkoutDay> = {};
    if (workoutDay.name !== undefined) updateData.name = workoutDay.name;
    if (workoutDay.exercises !== undefined) updateData.exercises = workoutDay.exercises;

    console.log("[Storage] Updating workout day:", id, "with data:", JSON.stringify(updateData, null, 2));

    const [updated] = await db
      .update(workoutDays)
      .set(updateData)
      .where(eq(workoutDays.id, id))
      .returning();

    if (!updated) throw new Error("Workout day not found");

    console.log("[Storage] Updated workout day result:", JSON.stringify(updated, null, 2));
    return updated;
  }

  async deleteWorkoutLog(id: number): Promise<void> {
    const [deleted] = await db
      .delete(workoutLogs)
      .where(eq(workoutLogs.id, id))
      .returning();
    if (!deleted) throw new Error("Workout log not found");
  }

  async deleteUser(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(workoutLogs).where(eq(workoutLogs.userId, id));
      await tx.delete(workoutDays).where(eq(workoutDays.userId, id));
      await tx.delete(exercises).where(eq(exercises.userId, id));
      await tx.delete(users).where(eq(users.id, id));
    });
  }

  async getExercise(id: number): Promise<Exercise | undefined> {
    const [exercise] = await db.select().from(exercises).where(eq(exercises.id, id));
    return exercise;
  }

  async getExerciseWorkoutConfig(exerciseId: number, userId: number): Promise<WorkoutDay | undefined> {
    console.log("[Storage] Getting workout config for exercise:", exerciseId, "and user:", userId);
    const workoutDays = await this.getWorkoutDays(userId);
    console.log("[Storage] Found workout days for user:", workoutDays);

    // Create default workout day if none exists
    if (!workoutDays || workoutDays.length === 0) {
        console.log("[Storage] No workout days found, creating default configuration");
        const defaultWorkoutDay = await this.createWorkoutDay({
            userId,
            name: "Default Workout",
            exercises: [{
                exerciseId,
                parameters: {
                    scheme: "STS",
                    minSets: 3,
                    maxSets: 5,
                    minReps: 5,
                    maxReps: 8,
                    restBetweenSets: 90,
                    restBetweenExercises: 180
                }
            }]
        });
        console.log("[Storage] Created default workout day:", defaultWorkoutDay);
        return defaultWorkoutDay;
    }

    const workoutDay = workoutDays.find(day => 
        day.exercises.some(ex => ex.exerciseId === exerciseId)
    );
    console.log("[Storage] Found workout day config:", workoutDay);

    // Add exercise to first workout day if not found in any
    if (!workoutDay && workoutDays.length > 0) {
        console.log("[Storage] Exercise not found in any workout day, adding to first workout day");
        const updatedWorkoutDay = {
            ...workoutDays[0],
            exercises: [...workoutDays[0].exercises, {
                exerciseId,
                parameters: {
                    scheme: "STS",
                    minSets: 3,
                    maxSets: 5,
                    minReps: 5,
                    maxReps: 8,
                    restBetweenSets: 90,
                    restBetweenExercises: 180
                }
            }]
        };
        const updated = await this.updateWorkoutDay(updatedWorkoutDay.id, updatedWorkoutDay);
        console.log("[Storage] Updated workout day with exercise:", updated);
        return updated;
    }

    return workoutDay;
  }

  async getLastWorkoutLog(userId: number, exerciseId: number): Promise<WorkoutLog | undefined> {
    console.log("[Storage] Getting last workout log for user:", userId, "and exercise:", exerciseId);
    const logs = await this.getUserWorkoutLogs(userId);
    console.log("[Storage] Found logs:", logs.length);

    // Find the most recent log that has sets for this exercise
    const relevantLog = logs.find(log => {
      console.log("[Storage] Checking log:", log.id, "sets:", log.sets);
      return log.sets.some(set => set.exerciseId === exerciseId);
    });

    if (relevantLog) {
      const exerciseSets = relevantLog.sets.find(s => s.exerciseId === exerciseId);
      if (exerciseSets && exerciseSets.sets.length > 0) {
        // Calculate 1RM using the STS formula for each set and take the highest
        const progression = new STSProgression();
        const calculated1RM = progression.calculate1RM(
          exerciseSets.sets.map(set => ({
            reps: set.reps,
            weight: set.weight,
            isFailure: false
          }))
        );

        console.log("[Storage] Exercise sets:", exerciseSets.sets);
        console.log("[Storage] Calculated 1RM:", calculated1RM);

        // Store the calculated 1RM
        exerciseSets.oneRm = calculated1RM;
      }
    } else {
      console.log("[Storage] No relevant workout logs found for exercise:", exerciseId);
    }

    return relevantLog;
  }

  async getNextSuggestion(exerciseId: number, userId: number, estimated1RM?: number): Promise<ProgressionSuggestion | ProgressionSuggestion[]> {
    console.log("[Storage] Getting next suggestion for exercise:", exerciseId, "and user:", userId, "estimated1RM:", estimated1RM);

    try {
        const exercise = await this.getExercise(exerciseId);
        if (!exercise) throw new Error("Exercise not found");

        const workoutDay = await this.getExerciseWorkoutConfig(exerciseId, userId);
        if (!workoutDay) {
            return {
                sets: 3,
                reps: 8,
                weight: exercise.startingWeight || 20,
                calculated1RM: (exercise.startingWeight || 20) * 1.26
            };
        }

        const exerciseConfig = workoutDay.exercises.find(ex => ex.exerciseId === exerciseId);
        if (!exerciseConfig) {
            return {
                sets: 3,
                reps: 8,
                weight: exercise.startingWeight || 20,
                calculated1RM: (exercise.startingWeight || 20) * 1.26
            };
        }

        if (exerciseConfig.parameters.scheme === "STS") {
            let last1RM = 0;

            if (estimated1RM) {
                console.log("[Storage] Using provided estimated 1RM:", estimated1RM);
                last1RM = estimated1RM;
            } else {
                const lastLog = await this.getLastWorkoutLog(userId, exerciseId);
                const lastSetData = lastLog?.sets.find(s => s.exerciseId === exerciseId);
                last1RM = lastSetData?.oneRm ?? 0;
                console.log("[Storage] Using calculated 1RM from logs:", last1RM);
            }

            const increment = exercise.increment || 2.5;
            const { minSets, maxSets, minReps, maxReps } = exerciseConfig.parameters;

            // Generate all possible set/rep combinations
            const combinations: Array<{ sets: number; reps: number; multiplier: number }> = [];
            for (let sets = minSets; sets <= maxSets; sets++) {
                for (let reps = minReps; reps <= maxReps; reps++) {
                    const multiplier = (1 + 0.025 * reps) * (1 + 0.025 * (sets - 1));
                    combinations.push({ sets, reps, multiplier });
                }
            }

            // Sort by multiplier to find combinations that give similar 1RMs
            combinations.sort((a, b) => a.multiplier - b.multiplier);

            // Select 5 combinations that give progressively higher 1RMs
            const selectedCombos = [
                combinations[0], // Lowest multiplier
                combinations[Math.floor(combinations.length * 0.25)],
                combinations[Math.floor(combinations.length * 0.5)],
                combinations[Math.floor(combinations.length * 0.75)],
                combinations[combinations.length - 1] // Highest multiplier
            ];

            // Calculate base weight needed for the target 1RM
            const baseWeight = last1RM > 0 ? 
                last1RM / selectedCombos[0].multiplier : // Use last 1RM if available
                exercise.startingWeight || 20;

            // Generate suggestions with small weight increments
            const suggestions: ProgressionSuggestion[] = selectedCombos.map((combo, i) => {
                // Add small increments to the weight for each suggestion
                const weight = baseWeight + (i * increment);
                const roundedWeight = Math.ceil(weight / increment) * increment;
                const projected1RM = roundedWeight * combo.multiplier;

                return {
                    sets: combo.sets,
                    reps: combo.reps,
                    weight: Math.round(roundedWeight * 2) / 2,
                    calculated1RM: Math.round(projected1RM * 2) / 2
                };
            });

            console.log("[Storage] Generated STS suggestions:", suggestions);
            return suggestions;
        }

        // For other progression schemes, return a single suggestion
        return {
            sets: 3,
            reps: 8,
            weight: exercise.startingWeight || 20,
            calculated1RM: (exercise.startingWeight || 20) * 1.26
        };

    } catch (error) {
        console.error("[Storage] Error in getNextSuggestion:", error);
        throw new Error("Failed to generate workout suggestion");
    }
}

async deleteWorkoutDay(id: number): Promise<void> {
    const [deleted] = await db
      .delete(workoutDays)
      .where(eq(workoutDays.id, id))
      .returning();
    if (!deleted) throw new Error("Workout day not found");
  }
}

export const storage = new DatabaseStorage();