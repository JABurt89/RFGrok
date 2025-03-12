import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertExerciseSchema, insertWorkoutDaySchema, insertWorkoutLogSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Exercise routes
  app.get("/api/exercises", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const exercises = await storage.getExercises(req.user.id);
    res.json(exercises);
  });

  app.post("/api/exercises", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const parsed = insertExerciseSchema.parse({ ...req.body, userId: req.user.id });
    const exercise = await storage.createExercise(parsed);
    res.json(exercise);
  });

  app.patch("/api/exercises/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const exercise = await storage.updateExercise(parseInt(req.params.id), req.body);
    res.json(exercise);
  });

  // Workout day routes
  app.get("/api/workout-days", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const workoutDays = await storage.getWorkoutDays(req.user.id);
    res.json(workoutDays);
  });

  app.post("/api/workout-days", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      console.log("Creating workout day with body:", JSON.stringify(req.body, null, 2));

      const parsed = insertWorkoutDaySchema.parse({
        ...req.body,
        userId: req.user.id
      });

      const workoutDay = await storage.createWorkoutDay(parsed);
      res.json(workoutDay);
    } catch (error) {
      console.error("Error creating workout day:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Workout log routes
  app.get("/api/workout-logs", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const workoutLogs = await storage.getWorkoutLogs(req.user.id);
    res.json(workoutLogs);
  });

  app.post("/api/workout-logs", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const parsed = insertWorkoutLogSchema.parse({ ...req.body, userId: req.user.id });
    const workoutLog = await storage.createWorkoutLog(parsed);
    res.json(workoutLog);
  });

  app.patch("/api/workout-logs/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const workoutLog = await storage.updateWorkoutLog(parseInt(req.params.id), req.body);
    res.json(workoutLog);
  });

  const httpServer = createServer(app);
  return httpServer;
}