import { IStorage } from "@shared/schema";
import { User, InsertUser, Exercise, InsertExercise, WorkoutDay, InsertWorkoutDay, WorkoutLog, InsertWorkoutLog, EquipmentType, InsertEquipmentType } from "@shared/schema";
import { db } from "./db";
import { users, equipmentTypes, exercises, workoutDays, workoutLogs } from "@shared/schema";
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
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

  async getEquipment(userId: number | null): Promise<EquipmentType[]> {
    return db.select().from(equipmentTypes).where(eq(equipmentTypes.userId, userId));
  }

  async createEquipment(insertEquipment: InsertEquipmentType): Promise<EquipmentType> {
    const [equipment] = await db.insert(equipmentTypes).values(insertEquipment).returning();
    return equipment;
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

  async getWorkoutLogs(userId: number): Promise<WorkoutLog[]> {
    return db.select().from(workoutLogs).where(eq(workoutLogs.userId, userId));
  }

  async createWorkoutLog(insertWorkoutLog: InsertWorkoutLog): Promise<WorkoutLog> {
    const [workoutLog] = await db.insert(workoutLogs).values(insertWorkoutLog).returning();
    return workoutLog;
  }

  async updateWorkoutLog(id: number, workoutLog: Partial<WorkoutLog>): Promise<WorkoutLog> {
    const [updated] = await db
      .update(workoutLogs)
      .set(workoutLog)
      .where(eq(workoutLogs.id, id))
      .returning();
    if (!updated) throw new Error("Workout log not found");
    return updated;
  }
}

export const storage = new DatabaseStorage();