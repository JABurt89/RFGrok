import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";

export function registerRoutes(app: Express): Server {
  // Set up authentication routes first - must be before any API routes
  setupAuth(app);

  app.use((req, res, next) => {
    console.log("[Auth] Request session:", req.session);
    console.log("[Auth] Authentication status:", {
      isAuthenticated: req.isAuthenticated(),
      user: req.user?.id
    });
    next();
  });

  // Workout days routes
  app.get("/api/workout-days", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
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

  // Add workout day POST endpoint
  app.post("/api/workout-days", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      console.log("[Workout Days] Creating workout day with data:", req.body);
      const workoutDay = await storage.createWorkoutDay({
        ...req.body,
        userId: req.user.id
      });
      res.status(201).json(workoutDay);
    } catch (error) {
      console.error("[Workout Days] Error creating:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to create workout day"
      });
    }
  });

  // Update workout day
  app.patch("/api/workout-days/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const workoutDayId = parseInt(req.params.id);
      const workoutDay = await storage.getWorkoutDays(req.user.id);
      const userWorkoutDay = workoutDay.find(wd => wd.id === workoutDayId);

      if (!userWorkoutDay) {
        return res.status(403).json({ error: "Workout day not found or unauthorized" });
      }

      const updatedWorkoutDay = await storage.updateWorkoutDay(workoutDayId, req.body);
      res.json(updatedWorkoutDay);
    } catch (error) {
      console.error("[Workout Days] Error updating:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to update workout day"
      });
    }
  });

  // Delete workout day
  app.delete("/api/workout-days/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const workoutDayId = parseInt(req.params.id);
      const workoutDay = await storage.getWorkoutDays(req.user.id);
      const userWorkoutDay = workoutDay.find(wd => wd.id === workoutDayId);

      if (!userWorkoutDay) {
        return res.status(403).json({ error: "Workout day not found or unauthorized" });
      }

      await storage.deleteWorkoutDay(workoutDayId);
      res.sendStatus(200);
    } catch (error) {
      console.error("[Workout Days] Error deleting:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to delete workout day"
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
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const logs = await storage.getUserWorkoutLogs(req.user.id);
      res.json(logs);
    } catch (error) {
      console.error("[Workout Logs] Error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch workout logs"
      });
    }
  });

  // Create workout log
  app.post("/api/workout-logs", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      const workoutLog = await storage.createWorkoutLog({
        ...req.body,
        userId: req.user.id // Ensure user ID is set from session
      });
      res.status(201).json(workoutLog);
    } catch (error) {
      console.error("[Workout Logs] Error creating log:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to create workout log"
      });
    }
  });

  // Update workout log
  app.patch("/api/workout-logs/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      // Verify the workout log belongs to the authenticated user
      const existingLog = await storage.getWorkoutLog(parseInt(req.params.id));
      if (!existingLog || existingLog.userId !== req.user.id) {
        return res.sendStatus(403);
      }

      const workoutLog = await storage.updateWorkoutLog(parseInt(req.params.id), req.body);
      res.json(workoutLog);
    } catch (error) {
      console.error("[Workout Logs] Error updating log:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to update workout log"
      });
    }
  });

  // Workout suggestion
  app.get("/api/workout-suggestion", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const exerciseId = parseInt(req.query.exerciseId as string);
      const estimated1RM = req.query.estimated1RM ? parseFloat(req.query.estimated1RM as string) : undefined;

      if (isNaN(exerciseId) || !exerciseId) {
        return res.status(400).json({ error: "Exercise ID is required" });
      }

      const suggestion = await storage.getNextSuggestion(exerciseId, req.user.id, estimated1RM);
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