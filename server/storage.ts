import { User, InsertUser, Exercise, InsertExercise, WorkoutDay, InsertWorkoutDay, WorkoutLog, InsertWorkoutLog } from "@shared/schema";
import { db } from "./db";
import { users, exercises, workoutDays, workoutLogs } from "@shared/schema";
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { encrypt, decrypt } from "./utils";

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

  async getWorkoutDays(userId: number): Promise<WorkoutDay[]> {
    return db.select().from(workoutDays).where(eq(workoutDays.userId, userId));
  }

  async createWorkoutDay(insertWorkoutDay: InsertWorkoutDay): Promise<WorkoutDay> {
    const [workoutDay] = await db.insert(workoutDays).values(insertWorkoutDay).returning();
    return workoutDay;
  }

  async updateWorkoutDay(id: number, workoutDay: Partial<WorkoutDay>): Promise<WorkoutDay> {
    const [updated] = await db
      .update(workoutDays)
      .set(workoutDay)
      .where(eq(workoutDays.id, id))
      .returning();
    if (!updated) throw new Error("Workout day not found");
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
}

export const storage = new DatabaseStorage();