import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";

export function registerRoutes(app: Express): Server {
  // Workout days routes
  app.get("/api/workout-days", async (req, res) => {
    try {
      console.log("[Workout Days] Fetching workout days for user:", req.user?.id);
      if (!req.isAuthenticated()) {
        console.log("[Workout Days] Request not authenticated");
        return res.sendStatus(401);
      }

      const workoutDays = await storage.getWorkoutDays(req.user.id);
      console.log("[Workout Days] Found workout days:", workoutDays.length);
      res.json(workoutDays);
    } catch (error) {
      console.error("[Workout Days] Error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch workout days"
      });
    }
  });

  // Exercises routes
  app.get("/api/exercises", async (req, res) => {
    try {
      console.log("[Exercises] Fetching exercises for user:", req.user?.id);
      if (!req.isAuthenticated()) {
        console.log("[Exercises] Request not authenticated");
        return res.sendStatus(401);
      }

      const exercises = await storage.getExercises(req.user.id);
      console.log("[Exercises] Found exercises:", exercises.length);
      res.json(exercises);
    } catch (error) {
      console.error("[Exercises] Error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch exercises"
      });
    }
  });

  // Workout logs routes
  app.get("/api/workout-logs", async (req, res) => {
    try {
      console.log("[Workout Logs] Fetching logs for user:", req.user?.id);
      if (!req.isAuthenticated()) {
        console.log("[Workout Logs] Request not authenticated");
        return res.sendStatus(401);
      }

      const logs = await storage.getUserWorkoutLogs(req.user.id);
      console.log("[Workout Logs] Found logs:", logs.length);
      res.json(logs);
    } catch (error) {
      console.error("[Workout Logs] Error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch workout logs"
      });
    }
  });

  app.get("/api/workout-suggestion", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        console.log("[Workout Suggestion] Request not authenticated");
        return res.sendStatus(401);
      }

      const exerciseId = parseInt(req.query.exerciseId as string);
      const estimated1RM = req.query.estimated1RM ? parseFloat(req.query.estimated1RM as string) : undefined;
      console.log("[Workout Suggestion] Request parameters:", {
        exerciseId,
        estimated1RM,
        userId: req.user.id
      });

      if (isNaN(exerciseId) || !exerciseId) {
        console.log("[Workout Suggestion] Invalid exercise ID:", req.query.exerciseId);
        return res.status(400).json({ error: "Exercise ID is required" });
      }

      const exercise = await storage.getExercise(exerciseId);
      if (!exercise) {
        console.log("[Workout Suggestion] Exercise not found:", exerciseId);
        return res.status(404).json({ error: "Exercise not found" });
      }
      console.log("[Workout Suggestion] Found exercise:", exercise);

      // Get workout configuration to determine if it's STS or another scheme
      const workoutDay = await storage.getExerciseWorkoutConfig(exerciseId, req.user.id);
      const exerciseConfig = workoutDay?.exercises.find(ex => ex.exerciseId === exerciseId);
      console.log("[Workout Suggestion] Exercise config:", exerciseConfig);

      const suggestion = await storage.getNextSuggestion(exerciseId, req.user.id, estimated1RM);
      console.log("[Workout Suggestion] Generated suggestion:", suggestion);

      res.json(suggestion);
    } catch (error) {
      console.error("[Workout Suggestion] Error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get workout suggestion"
      });
    }
  });

  // Set up authentication routes
  setupAuth(app);

  const httpServer = createServer(app);
  return httpServer;
}