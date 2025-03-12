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
    res.setHeader('Content-Type', 'application/json');
    const exercises = await storage.getExercises(req.user.id);
    res.json(exercises);
  });

  app.post("/api/exercises", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.setHeader('Content-Type', 'application/json');
    const parsed = insertExerciseSchema.parse({ ...req.body, userId: req.user.id });
    const exercise = await storage.createExercise(parsed);
    res.json(exercise);
  });

  app.patch("/api/exercises/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.setHeader('Content-Type', 'application/json');
    const exercise = await storage.updateExercise(parseInt(req.params.id), req.body);
    res.json(exercise);
  });

  // Workout day routes
  app.get("/api/workout-days", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.setHeader('Content-Type', 'application/json');
    const workoutDays = await storage.getWorkoutDays(req.user.id);
    res.json(workoutDays);
  });

  app.post("/api/workout-days", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      // Log the incoming request
      console.log("[Workout Day Creation] Request path:", req.path);
      console.log("[Workout Day Creation] Request body:", JSON.stringify(req.body, null, 2));

      const parsed = insertWorkoutDaySchema.parse({
        ...req.body,
        userId: req.user.id
      });

      // Log the parsed data
      console.log("[Workout Day Creation] Parsed data:", JSON.stringify(parsed, null, 2));

      const workoutDay = await storage.createWorkoutDay(parsed);

      // Set content type and send response
      res.setHeader('Content-Type', 'application/json');
      res.json(workoutDay);
    } catch (error) {
      console.error("[Workout Day Creation] Error:", error);

      res.setHeader('Content-Type', 'application/json');
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  });

  // Workout log routes
  app.get("/api/workout-logs", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.setHeader('Content-Type', 'application/json');
    const workoutLogs = await storage.getWorkoutLogs(req.user.id);
    res.json(workoutLogs);
  });

  app.post("/api/workout-logs", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.setHeader('Content-Type', 'application/json');
    const parsed = insertWorkoutLogSchema.parse({ ...req.body, userId: req.user.id });
    const workoutLog = await storage.createWorkoutLog(parsed);
    res.json(workoutLog);
  });

  app.patch("/api/workout-logs/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.setHeader('Content-Type', 'application/json');
    const workoutLog = await storage.updateWorkoutLog(parseInt(req.params.id), req.body);
    res.json(workoutLog);
  });

  const httpServer = createServer(app);
  return httpServer;
}