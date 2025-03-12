import { useState } from "react";
import { WorkoutDayForm } from "../components/workout-day-form";
import { Sheet, SheetContent, SheetTrigger } from "../components/ui/sheet";
import { Button } from "../components/ui/button";
import { Link } from "wouter";
import { Home, Plus, DumbbellIcon, Edit } from "lucide-react";

interface WorkoutDay {
  name: string;
  exercises: {
    exerciseId: number;
    progression: {
      scheme: string;
      sets: number;
      reps: number;
      restBetweenSets: number;
      restBetweenExercises: number;
      [key: string]: any; // For additional scheme-specific parameters
    };
  }[];
}

function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<WorkoutDay[]>([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<{ index: number; workout: WorkoutDay } | null>(null);

  const submitWorkoutDay = (data: WorkoutDay) => {
    console.log("Workout day submitted:", data);
    if (editingWorkout !== null) {
      // Update existing workout
      setWorkouts(prev => {
        const updated = [...prev];
        updated[editingWorkout.index] = data;
        return updated;
      });
      setEditingWorkout(null);
    } else {
      // Add new workout
      setWorkouts(prev => [...prev, data]);
    }
    setIsSheetOpen(false);
  };

  const handleEdit = (index: number, workout: WorkoutDay) => {
    setEditingWorkout({ index, workout });
    setIsSheetOpen(true);
  };

  const formatSchemeDetails = (progression: WorkoutDay["exercises"][0]["progression"]) => {
    const base = `${progression.sets} sets × ${progression.reps} reps`;

    switch (progression.scheme) {
      case "STS":
        return `${base} (${progression.minReps}-${progression.maxReps} reps range)`;
      case "Double Progression":
        return `${base} (Target: ${progression.targetSets} sets)`;
      case "RPT Top-Set":
      case "RPT Individual":
        return `${base} (${progression.dropPercent}% drop per set)`;
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
                workoutDay={editingWorkout?.workout}
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
            workouts.map((workout, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-xl font-semibold">{workout.name}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(index, workout)}
                    className="flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                </div>
                <div className="space-y-3">
                  {workout.exercises.map((exercise, idx) => (
                    <div key={idx} className="pl-4 py-2 border-l-2">
                      <p className="font-medium">Exercise {idx + 1}</p>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Scheme: {exercise.progression.scheme}</p>
                        <p>{formatSchemeDetails(exercise.progression)}</p>
                        <p>Rest: {exercise.progression.restBetweenSets}s between sets / {exercise.progression.restBetweenExercises}s between exercises</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default WorkoutsPage;