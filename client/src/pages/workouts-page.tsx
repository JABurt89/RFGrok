import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { WorkoutDay, Exercise } from "@/types";
import { Link } from "wouter";
import { Plus, DumbbellIcon, Edit, Play, History, Home } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import WorkoutLogger from "@/components/workout-logger";
import { useAuth } from "@/hooks/use-auth";
import { WorkoutDayForm } from "@/components/workout-day-form";
import type { 
  STSParameters,
  DoubleProgressionParameters,
  RPTTopSetParameters,
  RPTIndividualParameters 
} from "@shared/progression-types";

// Helper Types
type WorkoutParameters = 
  | STSParameters 
  | DoubleProgressionParameters 
  | RPTTopSetParameters 
  | RPTIndividualParameters;

// Custom hook for data fetching
function useWorkoutData() {
  const { user } = useAuth();

  const workoutsQuery = useQuery<WorkoutDay[]>({
    queryKey: ["/api/workout-days"],
    enabled: !!user,
  });

  const exercisesQuery = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
    enabled: !!user,
  });

  return {
    workouts: workoutsQuery.data ?? [],
    exercises: exercisesQuery.data ?? [],
    isLoading: workoutsQuery.isLoading,
    error: workoutsQuery.error || exercisesQuery.error,
    user
  };
}

// Helper to format workout scheme details
function formatSchemeDetails(parameters?: WorkoutParameters): string {
  if (!parameters) return "No scheme details";

  const schemes: Record<string, (p: any) => string> = {
    "STS": (p) => `${p.scheme} (${p.minSets}-${p.maxSets} sets × ${p.minReps}-${p.maxReps} reps)`,
    "Double Progression": (p) => `${p.scheme} (${p.targetSets} sets × ${p.minReps}-${p.maxReps} reps)`,
    "RPT Top-Set": (p) => `${p.scheme} (${p.sets} sets, ${p.minReps}-${p.maxReps} reps)`,
    "RPT Individual": (p) => `${p.scheme} (${p.sets} sets, custom rep ranges)`
  };

  return schemes[parameters.scheme]?.(parameters) ?? "Unknown scheme";
}

// Workout Card Component
function WorkoutCard({ 
  workout,
  exercises,
  onEdit,
  onStart 
}: {
  workout: WorkoutDay;
  exercises: Exercise[];
  onEdit: (workout: WorkoutDay) => void;
  onStart: (workout: WorkoutDay) => void;
}) {
  const getExerciseName = (exerciseId: number) => 
    exercises.find(e => e.id === exerciseId)?.name ?? "Unknown Exercise";

  return (
    <div className="border rounded-lg p-4 bg-card shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between border-b pb-4 mb-4">
        <div>
          <h3 className="text-xl font-semibold">{workout.name}</h3>
          <p className="text-sm text-muted-foreground">
            {workout.exercises.length} exercise{workout.exercises.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(workout)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            size="sm"
            onClick={() => onStart(workout)}
          >
            <Play className="h-4 w-4 mr-2" />
            Start
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {workout.exercises.map((exercise, idx) => {
          const exerciseName = getExerciseName(exercise.exerciseId);
          const exerciseDetails = exercises.find(e => e.id === exercise.exerciseId);

          return (
            <div key={idx} className="p-3 rounded-md bg-muted/50">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{exerciseName}</h4>
                {exerciseDetails?.equipmentName && (
                  <span className="text-sm text-muted-foreground">
                    {exerciseDetails.equipmentName}
                  </span>
                )}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                <p>{formatSchemeDetails(exercise.parameters)}</p>
                {exercise.parameters && (
                  <p className="mt-1">
                    Rest: {exercise.parameters.restBetweenSets}s between sets,{" "}
                    {exercise.parameters.restBetweenExercises}s after exercise
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Main Component
function WorkoutsPage() {
  const { workouts, exercises, isLoading, error, user } = useWorkoutData();
  const [activeWorkout, setActiveWorkout] = useState<{
    workout: WorkoutDay;
    exerciseIndex: number;
  } | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutDay | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Early return for unauthenticated users
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Please Log In</h2>
          <Link href="/auth">
            <Button>Go to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Error Loading Data</h2>
          <p className="text-red-500">{error.message}</p>
        </div>
      </div>
    );
  }

  const handleWorkoutComplete = () => {
    if (!activeWorkout) return;

    if (activeWorkout.exerciseIndex < activeWorkout.workout.exercises.length - 1) {
      setActiveWorkout({
        ...activeWorkout,
        exerciseIndex: activeWorkout.exerciseIndex + 1
      });
    } else {
      setActiveWorkout(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DumbbellIcon className="h-6 w-6" />
            <h1 className="text-xl font-bold">Workout Planner</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/workout-history">
              <Button variant="ghost">
                <History className="h-4 w-4 mr-2" />
                History
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost">
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Workouts</h2>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Workout
          </Button>
        </div>

        {/* Workout List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center p-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="mt-4 text-muted-foreground">Loading workouts...</p>
            </div>
          ) : workouts.length === 0 ? (
            <div className="text-center p-8 border rounded-lg bg-muted/50">
              <p className="text-muted-foreground">
                No workouts yet. Click "Add Workout" to create your first workout.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {workouts.map((workout) => (
                <WorkoutCard
                  key={workout.id}
                  workout={workout}
                  exercises={exercises}
                  onEdit={setEditingWorkout}
                  onStart={(workout) => setActiveWorkout({ workout, exerciseIndex: 0 })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Workout Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-[600px] h-[90vh] p-0">
          <WorkoutDayForm
            onComplete={() => {
              setIsCreateModalOpen(false);
              queryClient.invalidateQueries({ queryKey: ["/api/workout-days"] });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Workout Modal */}
      <Dialog open={!!editingWorkout} onOpenChange={() => setEditingWorkout(null)}>
        <DialogContent className="max-w-[600px] h-[90vh] p-0">
          {editingWorkout && (
            <WorkoutDayForm
              workoutDay={editingWorkout}
              onComplete={() => {
                setEditingWorkout(null);
                queryClient.invalidateQueries({ queryKey: ["/api/workout-days"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Active Workout Modal */}
      <Dialog 
        open={!!activeWorkout} 
        onOpenChange={(open) => !open && setActiveWorkout(null)}
      >
        <DialogContent className="max-w-lg">
          {activeWorkout && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Exercise {activeWorkout.exerciseIndex + 1} of {activeWorkout.workout.exercises.length}
                </h2>
                <span className="text-sm text-muted-foreground">
                  {exercises.find(e => e.id === activeWorkout.workout.exercises[activeWorkout.exerciseIndex].exerciseId)?.name}
                </span>
              </div>
              <WorkoutLogger
                key={`${activeWorkout.workout.id}-${activeWorkout.exerciseIndex}`}
                exerciseId={activeWorkout.workout.exercises[activeWorkout.exerciseIndex].exerciseId}
                workoutDayId={activeWorkout.workout.id}
                parameters={activeWorkout.workout.exercises[activeWorkout.exerciseIndex].parameters}
                onComplete={handleWorkoutComplete}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default WorkoutsPage;