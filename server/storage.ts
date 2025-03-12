import { IStorage } from "@shared/schema";
import { User, InsertUser, Exercise, InsertExercise, WorkoutDay, InsertWorkoutDay, WorkoutLog, InsertWorkoutLog, EquipmentType, InsertEquipmentType } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private equipment: Map<number, EquipmentType>;
  private exercises: Map<number, Exercise>;
  private workoutDays: Map<number, WorkoutDay>;
  private workoutLogs: Map<number, WorkoutLog>;
  sessionStore: session.Store;
  currentId: number;

  constructor() {
    this.users = new Map();
    this.equipment = new Map();
    this.exercises = new Map();
    this.workoutDays = new Map();
    this.workoutLogs = new Map();
    this.currentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });

    // Add default equipment
    this.equipment.set(1, {
      id: 1,
      userId: null,
      name: "Barbell",
      defaultWeight: 20,
      increment: 2.5,
      units: "kg",
      isCustom: false,
    });
    this.equipment.set(2, {
      id: 2,
      userId: null,
      name: "Dumbbell",
      defaultWeight: 2.5,
      increment: 1,
      units: "kg",
      isCustom: false,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getEquipment(userId: number | null): Promise<EquipmentType[]> {
    return Array.from(this.equipment.values()).filter(
      (eq) => eq.userId === userId || eq.userId === null,
    );
  }

  async createEquipment(insertEquipment: InsertEquipmentType): Promise<EquipmentType> {
    const id = this.currentId++;
    const equipment: EquipmentType = { ...insertEquipment, id };
    this.equipment.set(id, equipment);
    return equipment;
  }

  async getExercises(userId: number): Promise<Exercise[]> {
    return Array.from(this.exercises.values()).filter(
      (ex) => ex.userId === userId,
    );
  }

  async createExercise(insertExercise: InsertExercise): Promise<Exercise> {
    const id = this.currentId++;
    const exercise: Exercise = { ...insertExercise, id };
    this.exercises.set(id, exercise);
    return exercise;
  }

  async updateExercise(id: number, exercise: Partial<Exercise>): Promise<Exercise> {
    const existing = this.exercises.get(id);
    if (!existing) throw new Error("Exercise not found");
    const updated = { ...existing, ...exercise };
    this.exercises.set(id, updated);
    return updated;
  }

  async getWorkoutDays(userId: number): Promise<WorkoutDay[]> {
    return Array.from(this.workoutDays.values()).filter(
      (wd) => wd.userId === userId,
    );
  }

  async createWorkoutDay(insertWorkoutDay: InsertWorkoutDay): Promise<WorkoutDay> {
    const id = this.currentId++;
    const workoutDay: WorkoutDay = { ...insertWorkoutDay, id };
    this.workoutDays.set(id, workoutDay);
    return workoutDay;
  }

  async getWorkoutLogs(userId: number): Promise<WorkoutLog[]> {
    return Array.from(this.workoutLogs.values()).filter(
      (wl) => wl.userId === userId,
    );
  }

  async createWorkoutLog(insertWorkoutLog: InsertWorkoutLog): Promise<WorkoutLog> {
    const id = this.currentId++;
    const workoutLog: WorkoutLog = { ...insertWorkoutLog, id };
    this.workoutLogs.set(id, workoutLog);
    return workoutLog;
  }

  async updateWorkoutLog(id: number, workoutLog: Partial<WorkoutLog>): Promise<WorkoutLog> {
    const existing = this.workoutLogs.get(id);
    if (!existing) throw new Error("Workout log not found");
    const updated = { ...existing, ...workoutLog };
    this.workoutLogs.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();
