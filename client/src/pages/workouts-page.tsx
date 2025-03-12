import { useState } from "react";
import { WorkoutDayForm } from "../components/workout-day-form";
import { Sheet, SheetContent, SheetTrigger } from "../components/ui/sheet";
import { Button } from "../components/ui/button";
import { Link } from "wouter";
import { Home, Plus, DumbbellIcon, Edit, Play } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import WorkoutLogger from "@/components/workout-logger";
import { useMutation, useQuery } from "@tanstack/react-query";
import { WorkoutDay, Exercise } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function WorkoutsPage() {
  const { toast } = useToast();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<{ index: number; workout: WorkoutDay } | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutDay | null>(null);

  // Fetch workouts and exercises
  const { data: workouts = [] } = useQuery<WorkoutDay[]>({
    queryKey: ["/api/workout-days"],
  });

  const { data: exercises = [] } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
  });

  // Create workout mutation
  const createWorkoutMutation = useMutation({
    mutationFn: async (data: Partial<WorkoutDay>) => {
      const response = await apiRequest("POST", "/api/workout-days", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create workout");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-days"] });
      toast({
        title: "Success",
        description: "Workout day created successfully",
      });
      setIsSheetOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const submitWorkoutDay = (data: Partial<WorkoutDay>) => {
    console.log("Workout day submitted:", data);
    createWorkoutMutation.mutate(data);
  };

  const handleEdit = (workout: WorkoutDay) => {
    setEditingWorkout({ index: workouts.findIndex(w => w.id === workout.id), workout });
    setIsSheetOpen(true);
  };

  const handleBeginWorkout = (workout: WorkoutDay) => {
    setActiveWorkout(workout);
  };

  const formatSchemeDetails = (parameters: WorkoutDay["exercises"][0]["parameters"]) => {
    switch (parameters.scheme) {
      case "STS":
        return `${parameters.scheme} (${parameters.minSets}-${parameters.maxSets} sets × ${parameters.minReps}-${parameters.maxReps} reps)`;
      case "Double Progression":
        return `${parameters.scheme} (${parameters.targetSets} sets × ${parameters.minReps}-${parameters.maxReps} reps)`;
      case "RPT Top-Set":
      case "RPT Individual":
        return `${parameters.scheme} (${parameters.sets} sets, ${parameters.targetReps} target reps, ${parameters.dropPercent}% drop)`;
      default:
        return parameters.scheme;
    }
  };

  const getExerciseName = (exerciseId: number) => {
    const exercise = exercises.find(e => e.id === exerciseId);
    return exercise?.name || "Unknown Exercise";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <nav className="border-b p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DumbbellIcon className="h-6 w-6" />
            <h1 className="text-xl font-bold">Workout Planner</h1>
          </div>
          <Link href="/">
            <Button variant="ghost" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Home
            </Button>
          </Link>
        </div>
      </nav>

      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Workouts</h2>
          <Sheet open={isSheetOpen} onOpenChange={(open) => {
            setIsSheetOpen(open);
            if (!open) setEditingWorkout(null);
          }}>
            <SheetTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Workout Day
              </Button>
            </SheetTrigger>
            <SheetContent>
              <WorkoutDayForm 
                submitWorkoutDay={submitWorkoutDay}
                key={isSheetOpen ? "open" : "closed"} // Force form reset when sheet opens/closes
              />
            </SheetContent>
          </Sheet>
        </div>

        <div className="grid gap-4">
          {workouts.length === 0 ? (
            <div className="text-center p-8 border rounded-lg bg-muted/50">
              <p className="text-muted-foreground">No workouts yet. Click "Add Workout Day" to create your first workout.</p>
            </div>
          ) : (
            workouts.map((workout) => (
              <div key={workout.id} className="border rounded-lg p-4 bg-card">
                <div className="flex items-center justify-between border-b pb-4 mb-4">
                  <div>
                    <h3 className="text-xl font-semibold">{workout.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(workout)}
                      className="flex items-center gap-2"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleBeginWorkout(workout)}
                      className="flex items-center gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Begin Workout
                    </Button>
                  </div>
                </div>
                <div className="space-y-4">
                  {workout.exercises.map((exercise, idx) => {
                    const exerciseName = getExerciseName(exercise.exerciseId);
                    const exerciseDetails = exercises.find(e => e.id === exercise.exerciseId);

                    return (
                      <div key={idx} className="p-4 rounded-md bg-muted/50">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-lg">{exerciseName}</h4>
                          {exerciseDetails && (
                            <span className="text-sm text-muted-foreground">
                              {exerciseDetails.equipmentName}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                          <p>{formatSchemeDetails(exercise.parameters)}</p>
                          <p>Rest periods: {exercise.parameters.restBetweenSets}s between sets, {exercise.parameters.restBetweenExercises}s between exercises</p>
                          {exerciseDetails && (
                            <p>Equipment details: Starting weight {exerciseDetails.startingWeight}{exerciseDetails.units}, {exerciseDetails.increment}{exerciseDetails.units} increments</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Active Workout Dialog */}
      <Dialog open={activeWorkout !== null} onOpenChange={(open) => !open && setActiveWorkout(null)}>
        <DialogContent className="max-w-lg">
          {activeWorkout && (
            <WorkoutLogger
              workoutDay={activeWorkout}
              onComplete={() => setActiveWorkout(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default WorkoutsPage;