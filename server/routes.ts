import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertExerciseSchema, insertWorkoutDaySchema, insertWorkoutLogSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/workout-suggestion", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const exerciseId = parseInt(req.query.exerciseId as string);
      if (!exerciseId) {
        return res.status(400).json({ error: "Exercise ID is required" });
      }

      // Get the exercise and workout configuration
      const exercise = await storage.getExercise(exerciseId);
      if (!exercise) {
        return res.status(404).json({ error: "Exercise not found" });
      }

      // Get the next suggestion using progression logic
      const suggestion = await storage.getNextSuggestion(exerciseId);

      res.json(suggestion);
    } catch (error) {
      console.error("[Workout Suggestion] Error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to get workout suggestion" 
      });
    }
  });

  // Other routes remain unchanged
  setupAuth(app);

  app.get("/api/exercises", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.setHeader('Content-Type', 'application/json');
    const exercises = await storage.getExercises(req.user.id);
    res.json(exercises);
  });

  const httpServer = createServer(app);
  return httpServer;
}