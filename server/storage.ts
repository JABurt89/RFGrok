import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { users, exercises, workoutDays, workoutLogs, type InsertUser, type InsertExercise, type InsertWorkoutDay, type InsertWorkoutLog } from "@shared/schema";

export class Storage {
  private db: PostgresJsDatabase;

  constructor(connectionString: string) {
    const client = postgres(connectionString);
    this.db = drizzle(client);
  }

  async migrate() {
    await migrate(this.db, { migrationsFolder: './drizzle' });
  }

  async getUser(id: number) {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async createExercise(exercise: InsertExercise) {
    const inserted = await this.db.insert(exercises).values(exercise).returning();
    return inserted[0];
  }

  async getExercises(userId: number) {
    return this.db.select().from(exercises).where(eq(exercises.userId, userId));
  }

  async updateExercise(id: number, updates: Partial<InsertExercise>) {
    const updated = await this.db.update(exercises).set(updates).where(eq(exercises.id, id)).returning();
    return updated[0];
  }

  async getWorkoutDays(userId: number) {
    return this.db.select().from(workoutDays).where(eq(workoutDays.userId, userId));
  }

  async createWorkoutDay(workoutDay: InsertWorkoutDay) {
    const inserted = await this.db.insert(workoutDays).values(workoutDay).returning();
    return inserted[0];
  }

  async getWorkoutLogs(userId: number) {
    return this.db.select().from(workoutLogs).where(eq(workoutLogs.userId, userId));
  }

  async createWorkoutLog(workoutLog: InsertWorkoutLog) {
    // Convert the ISO string to a Date object for database insertion
    const prepared = {
      ...workoutLog,
      date: new Date(workoutLog.date),
      sets: workoutLog.sets.map(set => ({
        ...set,
        sets: set.sets.map(s => ({
          ...s,
          timestamp: s.timestamp ? new Date(s.timestamp) : null
        }))
      }))
    };

    const inserted = await this.db.insert(workoutLogs).values(prepared).returning();
    return inserted[0];
  }

  async updateWorkoutLog(id: number, updates: Partial<InsertWorkoutLog>) {
    // Handle date conversion for updates
    const prepared = {
      ...updates,
      date: updates.date ? new Date(updates.date) : undefined,
      sets: updates.sets?.map(set => ({
        ...set,
        sets: set.sets.map(s => ({
          ...s,
          timestamp: s.timestamp ? new Date(s.timestamp) : null
        }))
      }))
    };

    const updated = await this.db.update(workoutLogs)
      .set(prepared)
      .where(eq(workoutLogs.id, id))
      .returning();
    return updated[0];
  }
}

export const storage = new Storage(process.env.DATABASE_URL || "postgres://localhost:5432/rfgrok");