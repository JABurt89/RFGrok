import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertExerciseSchema, insertWorkoutDaySchema, insertWorkoutLogSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/health/db", async (_req, res) => {
    try {
      await storage.getUser(1);
      res.json({ status: "ok", database: "connected" });
    } catch (error) {
      res.status(503).json({
        status: "error",
        database: "disconnected",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  setupAuth(app);

  app.get("/api/exercises", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.setHeader('Content-Type', 'application/json');
    const exercises = await storage.getExercises(req.user.id);
    res.json(exercises);
  });

  app.post("/api/exercises", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      res.setHeader('Content-Type', 'application/json');
      const parsed = insertExerciseSchema.parse({ ...req.body, userId: req.user.id });
      const exercise = await storage.createExercise(parsed);
      res.json(exercise);
    } catch (error) {
      res.setHeader('Content-Type', 'application/json');
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  });

  app.patch("/api/exercises/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      res.setHeader('Content-Type', 'application/json');
      const exercise = await storage.updateExercise(parseInt(req.params.id), req.body);
      res.json(exercise);
    } catch (error) {
      res.setHeader('Content-Type', 'application/json');
      res.status(400).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/workout-days", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.setHeader('Content-Type', 'application/json');
    const workoutDays = await storage.getWorkoutDays(req.user.id);
    res.json(workoutDays);
  });

  app.post("/api/workout-days", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const parsed = insertWorkoutDaySchema.parse({
        ...req.body,
        userId: req.user.id
      });
      const workoutDay = await storage.createWorkoutDay(parsed);
      res.setHeader('Content-Type', 'application/json');
      res.json(workoutDay);
    } catch (error) {
      res.setHeader('Content-Type', 'application/json');
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  });

  app.patch("/api/workout-days/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const workoutDay = await storage.updateWorkoutDay(parseInt(req.params.id), req.body);
      res.setHeader('Content-Type', 'application/json');
      res.json(workoutDay);
    } catch (error) {
      res.setHeader('Content-Type', 'application/json');
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  });

  app.get("/api/workout-logs", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.setHeader('Content-Type', 'application/json');
    const workoutLogs = await storage.getWorkoutLogs(req.user.id);
    res.json(workoutLogs);
  });

  app.post("/api/workout-logs", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      const workoutData = {
        ...req.body,
        userId: req.user.id,
        date: new Date(req.body.date),
        sets: req.body.sets.map((set: any) => ({
          ...set,
          sets: set.sets.map((s: any) => ({
            ...s,
            timestamp: new Date(s.timestamp)
          }))
        }))
      };
      const parsed = insertWorkoutLogSchema.parse(workoutData);
      const workoutLog = await storage.createWorkoutLog(parsed);
      res.json(workoutLog);
    } catch (error) {
      res.setHeader('Content-Type', 'application/json');
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Validation error", details: error.errors });
      } else {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  });

  app.get("/api/workout-suggestion", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const exerciseId = parseInt(req.query.exerciseId as string);
      console.log("[Route] Workout suggestion request for exercise:", exerciseId);

      if (isNaN(exerciseId) || !exerciseId) {
        console.log("[Route] Invalid exercise ID:", req.query.exerciseId);
        return res.status(400).json({ error: "Exercise ID is required" });
      }

      // Get the exercise and workout configuration
      const exercise = await storage.getExercise(exerciseId);
      if (!exercise) {
        console.log("[Route] Exercise not found:", exerciseId);
        return res.status(404).json({ error: "Exercise not found" });
      }

      // Get the next suggestion using progression logic
      const suggestion = await storage.getNextSuggestion(exerciseId);
      console.log("[Route] Returning suggestion:", suggestion);

      res.json(suggestion);
    } catch (error) {
      console.error("[Workout Suggestion] Error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to get workout suggestion" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}