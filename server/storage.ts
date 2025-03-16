import { User, InsertUser, Exercise, InsertExercise, WorkoutDay, InsertWorkoutDay, WorkoutLog, InsertWorkoutLog } from "@shared/schema";
import { db } from "./db";
import { users, exercises, workoutDays, workoutLogs } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
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
    })) as WorkoutLog[];
  }

  async getUserWorkoutLogs(userId: number): Promise<WorkoutLog[]> {
    console.log("[Storage] Getting workout logs for user:", userId);
    const logs = await db.select()
      .from(workoutLogs)
      .where(eq(workoutLogs.userId, userId))
      .where(eq(workoutLogs.isComplete, true))
      .orderBy(desc(workoutLogs.date));

    console.log("[Storage] Raw logs from database:", logs.length);
    const parsedLogs = logs.map(log => ({
      ...log,
      sets: typeof log.sets === 'string' ? JSON.parse(decrypt(log.sets)) : log.sets
    })) as WorkoutLog[];
    console.log("[Storage] First parsed log sets:", parsedLogs.length > 0 ? JSON.stringify(parsedLogs[0].sets, null, 2) : "No logs");

    return parsedLogs;
  }

  async createWorkoutLog(insertWorkoutLog: InsertWorkoutLog): Promise<WorkoutLog> {
    console.log("[Storage] Creating workout log:", insertWorkoutLog);

    // Ensure proper date format
    const formattedDate = new Date(insertWorkoutLog.date).toISOString();

    // Calculate 1RM for each exercise in sets
    const setsWith1RM = insertWorkoutLog.sets.map(setData => {
      let calculated1RM: number;
      switch (setData.parameters.scheme) {
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

      // Ensure all timestamps in sets are in ISO format
      const formattedSets = setData.sets.map(set => ({
        ...set,
        timestamp: new Date(set.timestamp).toISOString()
      }));

      return { 
        ...setData, 
        sets: formattedSets,
        oneRm: calculated1RM 
      };
    });

    const encryptedSets = encrypt(JSON.stringify(setsWith1RM));
    const [workoutLog] = await db
      .insert(workoutLogs)
      .values({
        userId: insertWorkoutLog.userId,
        date: formattedDate,
        sets: encryptedSets,
        isComplete: insertWorkoutLog.isComplete
      })
      .returning();

    return {
      ...workoutLog,
      sets: typeof workoutLog.sets === "string" ? JSON.parse(decrypt(workoutLog.sets)) : workoutLog.sets,
    } as WorkoutLog;
  }

  async updateWorkoutLog(id: number, updates: Partial<WorkoutLog>): Promise<WorkoutLog> {
    const updateData = { ...updates };

    if (updateData.sets) {
      const [workoutLog] = await db.select().from(workoutLogs).where(eq(workoutLogs.id, id));
      if (!workoutLog) throw new Error("Workout log not found");

      const setsWith1RM = updateData.sets.map(setData => {
        let calculated1RM: number;
        switch (setData.parameters.scheme) {
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
    const relevantLog = logs.find(log => log.sets.some(set => set.exerciseId === exerciseId));

    if (relevantLog) {
      const exerciseSets = relevantLog.sets.find(s => s.exerciseId === exerciseId);
      if (exerciseSets && exerciseSets.sets.length > 0) {
        // Calculate 1RM using the progression scheme's formula
        let calculated1RM: number;
        if (exerciseSets.parameters && exerciseSets.parameters.scheme) {
          switch (exerciseSets.parameters.scheme) {
            case "STS":
              const progression = new STSProgression();
              calculated1RM = progression.calculate1RM(
                exerciseSets.sets.map(set => ({
                  reps: set.reps,
                  weight: set.weight,
                  isFailure: false
                }))
              );
              break;
            default:
              calculated1RM = exerciseSets.sets[0].weight * (1 + 0.025 * exerciseSets.sets[0].reps);
          }
          exerciseSets.oneRm = calculated1RM;
        }
      }
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
                calculated1RM: (exercise.startingWeight || 20) * 1.26,
                parameters: { scheme: "STS" }
            };
        }

        const exerciseConfig = workoutDay.exercises.find(ex => ex.exerciseId === exerciseId);
        if (!exerciseConfig) {
            return {
                sets: 3,
                reps: 8,
                weight: exercise.startingWeight || 20,
                calculated1RM: (exercise.startingWeight || 20) * 1.26,
                parameters: { scheme: "STS" }
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

            const startingWeight = exercise.startingWeight || 20;
            const increment = exercise.increment || 2.5;
            const { minSets, maxSets, minReps, maxReps } = exerciseConfig.parameters;

            // Generate possible weights starting from startingWeight
            const maxWeight = startingWeight + 100 * increment; // Reasonable upper limit
            const possibleWeights = [];
            let weight = startingWeight;
            while (weight <= maxWeight) {
                possibleWeights.push(weight);
                weight += increment;
            }

            const suggestions: ProgressionSuggestion[] = [];

            // Generate all combinations and filter for progressive 1RMs
            for (let sets = minSets; sets <= maxSets; sets++) {
                for (let reps = minReps; reps <= maxReps; reps++) {
                    for (const weight of possibleWeights) {
                        const calculated1RM = weight * (1 + 0.025 * reps) * (1 + 0.025 * (sets - 1));
                        if (calculated1RM > last1RM) {
                            suggestions.push({
                                sets,
                                reps,
                                weight,
                                calculated1RM,
                                parameters: { ...exerciseConfig.parameters }
                            });
                        }
                    }
                }
            }

            // Sort by calculated1RM and take the first 5
            const sortedSuggestions = suggestions
                .sort((a, b) => a.calculated1RM! - b.calculated1RM!)
                .slice(0, 5);

            if (sortedSuggestions.length === 0) {
                console.log("[Storage] No progressive suggestions found for STS");
                throw new Error("NO_PROGRESSIVE_SUGGESTIONS");
            }

            console.log("[Storage] Generated STS suggestions:", sortedSuggestions);
            return sortedSuggestions;
        }

        // For other progression schemes, return a single suggestion
        return {
            sets: 3,
            reps: 8,
            weight: exercise.startingWeight || 20,
            calculated1RM: (exercise.startingWeight || 20) * 1.26,
            parameters: { scheme: exerciseConfig.parameters.scheme }
        };

    } catch (error) {
        console.error("[Storage] Error in getNextSuggestion:", error);
        throw error;
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