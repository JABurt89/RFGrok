import { useState } from "react";
import { WorkoutDayForm } from "../components/workout-day-form";
import { Sheet, SheetContent, SheetTrigger } from "../components/ui/sheet";
import { Button } from "../components/ui/button";
import { Link } from "wouter";
import { Home, Plus, DumbbellIcon, Edit, Play } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import WorkoutLogger from "@/components/workout-logger";
import { useQuery } from "@tanstack/react-query";
import { WorkoutDay } from "@shared/schema";

function WorkoutsPage() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<{ index: number; workout: WorkoutDay } | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutDay | null>(null);

  // Fetch workouts
  const { data: workouts = [] } = useQuery<WorkoutDay[]>({
    queryKey: ["/api/workout-days"],
  });

  const submitWorkoutDay = (data: WorkoutDay) => {
    console.log("Workout day submitted:", data);
    if (editingWorkout !== null) {
      // Update existing workout
      setEditingWorkout(null);
    }
    setIsSheetOpen(false);
  };

  const handleEdit = (workout: WorkoutDay) => {
    setEditingWorkout({ index: workouts.findIndex(w => w.id === workout.id), workout });
    setIsSheetOpen(true);
  };

  const handleBeginWorkout = (workout: WorkoutDay) => {
    setActiveWorkout(workout);
  };

  const formatSchemeDetails = (progression: WorkoutDay["exercises"][0]["parameters"]) => {
    const base = `${progression.scheme}`;

    switch (progression.scheme) {
      case "STS":
        return `${base} (${progression.minReps}-${progression.maxReps} reps)`;
      case "Double Progression":
        return `${base} (Target: ${progression.targetSets} sets)`;
      case "RPT Top-Set":
      case "RPT Individual":
        return `${base} (${progression.dropPercent}% drop)`;
      default:
        return base;
    }
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
              <div key={workout.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-xl font-semibold">{workout.name}</h3>
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
                <div className="space-y-3">
                  {workout.exercises.map((exercise, idx) => (
                    <div key={idx} className="pl-4 py-2 border-l-2">
                      <p className="font-medium">Exercise {idx + 1}</p>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Scheme: {formatSchemeDetails(exercise.parameters)}</p>
                        <p>Rest: {exercise.parameters.restBetweenSets}s between sets / {exercise.parameters.restBetweenExercises}s between exercises</p>
                      </div>
                    </div>
                  ))}
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