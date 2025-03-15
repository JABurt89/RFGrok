import { useState } from "react";
import { WorkoutDayForm } from "../components/workout-day-form";
import { Button } from "../components/ui/button";
import { Link } from "wouter";
import { Plus, DumbbellIcon, Edit, Play, History, Home } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { WorkoutDay, Exercise } from "@/types";
import { queryClient } from "@/lib/queryClient";
import WorkoutLogger from "@/components/workout-logger";
import { useAuth } from "@/hooks/use-auth";

function WorkoutsPage() {
  const { user } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedWorkoutDay, setSelectedWorkoutDay] = useState<WorkoutDay | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutDay | null>(null);

  // Fetch workouts and exercises
  const { data: workouts = [], isLoading: isLoadingWorkouts } = useQuery<WorkoutDay[]>({
    queryKey: ["/api/workout-days"],
    enabled: !!user
  });

  const { data: exercises = [] } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
    enabled: !!user
  });

  const handleEdit = (workout: WorkoutDay) => {
    setSelectedWorkoutDay(workout);
  };

  const handleStartWorkout = (workout: WorkoutDay) => {
    setActiveWorkout(workout);
  };

  const formatSchemeDetails = (parameters: WorkoutDay["exercises"][0]["parameters"]) => {
    switch (parameters.scheme) {
      case "STS":
        return `${parameters.scheme} (${parameters.minSets}-${parameters.maxSets} sets × ${parameters.minReps}-${parameters.maxReps} reps)`;
      case "Double Progression":
        return `${parameters.scheme} (${parameters.targetSets} sets × ${parameters.minReps}-${parameters.maxReps} reps)`;
      case "RPT Top-Set":
        return `${parameters.scheme} (${parameters.sets} sets, ${parameters.minReps}-${parameters.maxReps} reps)`;
      case "RPT Individual":
        return `${parameters.scheme} (${parameters.sets} sets, custom rep ranges)`;
      default:
        return parameters.scheme;
    }
  };

  const getExerciseName = (exerciseId: number) => {
    const exercise = exercises.find(e => e.id === exerciseId);
    return exercise?.name || "Unknown Exercise";
  };

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

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <nav className="border-b p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DumbbellIcon className="h-6 w-6" />
            <h1 className="text-xl font-bold">Workout Planner</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/workout-history">
              <Button variant="ghost" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                History
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Home
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Workouts</h2>
          <Button
            className="flex items-center gap-2"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Workout Day
          </Button>
        </div>

        <div className="space-y-4">
          {isLoadingWorkouts ? (
            <div className="text-center p-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading workouts...</p>
            </div>
          ) : workouts.length === 0 ? (
            <div className="text-center p-8 border rounded-lg bg-muted/50">
              <p className="text-muted-foreground">
                No workouts yet. Click "Add Workout Day" to create your first workout.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {workouts.map((workout) => (
                <div key={workout.id} className="border rounded-lg p-4 bg-card">
                  <div className="flex items-center justify-between border-b pb-4 mb-4">
                    <div>
                      <h3 className="text-xl font-semibold">{workout.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
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
                        size="sm"
                        onClick={() => handleStartWorkout(workout)}
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
                            <p>
                              Rest periods: {exercise.parameters.restBetweenSets}s between sets,{" "}
                              {exercise.parameters.restBetweenExercises}s between exercises
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
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
      {selectedWorkoutDay && (
        <Dialog open={true} onOpenChange={() => setSelectedWorkoutDay(null)}>
          <DialogContent className="max-w-[600px] h-[90vh] p-0">
            <WorkoutDayForm
              workoutDay={selectedWorkoutDay}
              onComplete={() => {
                setSelectedWorkoutDay(null);
                queryClient.invalidateQueries({ queryKey: ["/api/workout-days"] });
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Active Workout Dialog */}
      <Dialog open={activeWorkout !== null} onOpenChange={(open) => !open && setActiveWorkout(null)}>
        <DialogContent className="max-w-lg">
          {activeWorkout && (
            <WorkoutLogger
              exerciseId={activeWorkout.exercises[0].exerciseId}
              workoutDayId={activeWorkout.id}
              onComplete={() => setActiveWorkout(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default WorkoutsPage;