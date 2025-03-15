import { User, InsertUser, Exercise, InsertExercise, WorkoutDay, InsertWorkoutDay, WorkoutLog, InsertWorkoutLog } from "@shared/schema";
import { db } from "./db";
import { users, exercises, workoutDays, workoutLogs } from "@shared/schema";
import { eq } from "drizzle-orm";
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

  async createWorkoutLog(insertWorkoutLog: InsertWorkoutLog): Promise<WorkoutLog> {
    console.log("Creating workout log:", insertWorkoutLog);
    const encryptedSets = encrypt(JSON.stringify(insertWorkoutLog.sets));
    const [workoutLog] = await db.insert(workoutLogs)
      .values({
        ...insertWorkoutLog,
        sets: encryptedSets
      })
      .returning();

    return {
      ...workoutLog,
      sets: typeof workoutLog.sets === 'string' ?
        JSON.parse(decrypt(workoutLog.sets)) :
        workoutLog.sets
    };
  }

  async updateWorkoutLog(id: number, workoutLog: Partial<WorkoutLog>): Promise<WorkoutLog> {
    const updateData = { ...workoutLog };
    if (updateData.sets) {
      const encryptedSets = encrypt(JSON.stringify(updateData.sets));
      updateData.sets = encryptedSets;
    }

    const [updated] = await db
      .update(workoutLogs)
      .set(updateData)
      .where(eq(workoutLogs.id, id))
      .returning();

    if (!updated) throw new Error("Workout log not found");

    return {
      ...updated,
      sets: typeof updated.sets === 'string' ?
        JSON.parse(decrypt(updated.sets)) :
        updated.sets
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

  async getExerciseWorkoutConfig(exerciseId: number): Promise<WorkoutDay | undefined> {
    console.log("[Storage] Getting workout config for exercise:", exerciseId);
    const workoutDays = await this.getWorkoutDays(undefined);
    console.log("[Storage] Found workout days:", workoutDays);

    const workoutDay = workoutDays.find(day => 
      day.exercises.some(ex => ex.exerciseId === exerciseId)
    );
    console.log("[Storage] Found workout day config:", workoutDay);
    return workoutDay;
  }

  async getLastWorkoutLog(exerciseId: number): Promise<WorkoutLog | undefined> {
    console.log("[Storage] Getting last workout log for exercise:", exerciseId);
    const logs = await db.select()
      .from(workoutLogs)
      .where(eq(workoutLogs.isComplete, true))
      .orderBy(workoutLogs.date, 'desc')
      .limit(1);

    console.log("[Storage] Found logs:", logs);
    return logs[0];
  }

  async getNextSuggestion(exerciseId: number): Promise<ProgressionSuggestion> {
    console.log("[Storage] Getting next suggestion for exercise:", exerciseId);

    // Get exercise details
    const exercise = await this.getExercise(exerciseId);
    if (!exercise) {
      console.log("[Storage] Exercise not found:", exerciseId);
      throw new Error("Exercise not found");
    }
    console.log("[Storage] Found exercise:", exercise);

    // Get workout configuration
    const workoutDay = await this.getExerciseWorkoutConfig(exerciseId);
    if (!workoutDay) {
      console.log("[Storage] No workout day found for exercise:", exerciseId);
      // Return a default suggestion if no workout day is configured
      return {
        sets: 3,
        reps: 8,
        weight: exercise.startingWeight,
        calculated1RM: exercise.startingWeight * (1 + 0.025 * 8 * 3)
      };
    }
    console.log("[Storage] Found workout day:", workoutDay);

    const exerciseConfig = workoutDay.exercises.find(ex => ex.exerciseId === exerciseId);
    if (!exerciseConfig) {
      console.log("[Storage] No exercise config found in workout day");
      throw new Error("Exercise configuration not found");
    }
    console.log("[Storage] Found exercise config:", exerciseConfig);

    // Get last workout log
    const lastLog = await this.getLastWorkoutLog(exerciseId);
    console.log("[Storage] Last log:", lastLog);

    // Create appropriate progression scheme
    let progression;
    switch (exerciseConfig.parameters.scheme) {
      case "STS":
        progression = new STSProgression(
          exerciseConfig.parameters.minSets || 3,
          exerciseConfig.parameters.maxSets || 5,
          exerciseConfig.parameters.minReps || 5,
          exerciseConfig.parameters.maxReps || 8
        );
        break;
      case "Double Progression":
        progression = new DoubleProgression(
          exerciseConfig.parameters.targetSets || 3,
          exerciseConfig.parameters.minReps || 8,
          exerciseConfig.parameters.maxReps || 12
        );
        break;
      case "RPT Top-Set":
        progression = new RPTTopSetDependent(
          exerciseConfig.parameters.sets || 3,
          exerciseConfig.parameters.minReps || 6,
          exerciseConfig.parameters.maxReps || 8
        );
        break;
      case "RPT Individual":
        progression = new RPTIndividualProgression(
          exerciseConfig.parameters.sets || 3,
          exerciseConfig.parameters.setConfigs
        );
        break;
      default:
        console.log("[Storage] Using default STS progression");
        progression = new STSProgression();
    }

    // Get next suggestion
    const lastSetData = lastLog?.sets.find(s => s.exerciseId === exerciseId);
    const lastWeight = lastSetData?.sets[0]?.weight ?? exercise.startingWeight;
    console.log("[Storage] Using last weight:", lastWeight);

    const suggestions = progression.getNextSuggestion(lastWeight, exercise.increment);
    console.log("[Storage] Generated suggestions:", suggestions);

    // Return first suggestion with default values if undefined
    return suggestions[0] || {
      sets: 3,
      reps: 8,
      weight: exercise.startingWeight,
      calculated1RM: exercise.startingWeight * (1 + 0.025 * 8 * 3)
    };
  }
}

export const storage = new DatabaseStorage();