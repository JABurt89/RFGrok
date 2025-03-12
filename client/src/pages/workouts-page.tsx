// src/pages/workouts-page.tsx
import { useState } from "react";
import { WorkoutDayForm } from "../components/workout-day-form";
import { Sheet, SheetContent, SheetTrigger } from "../components/ui/sheet";
import { Button } from "../components/ui/button";

interface WorkoutDay {
  name: string;
  exercises: { name: string; scheme: string; restBetweenSets: number; restBetweenExercises: number }[];
}

function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<WorkoutDay[]>([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const submitWorkoutDay = (data: WorkoutDay) => {
    console.log("Workout day submitted:", data); // Debug log
    setWorkouts((prev) => [...prev, data]); // Add new workout to state
    setIsSheetOpen(false); // Close the sheet after submission
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Workouts</h1>
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <Button onClick={() => setIsSheetOpen(true)}>Add Workout Day</Button>
        </SheetTrigger>
        <SheetContent>
          <WorkoutDayForm submitWorkoutDay={submitWorkoutDay} />
        </SheetContent>
      </Sheet>

      <div className="mt-4">
        {workouts.length === 0 ? (
          <p>No workouts yet.</p>
        ) : (
          workouts.map((workout, index) => (
            <div key={index} className="mb-4 p-4 border rounded">
              <h2 className="text-xl font-semibold">{workout.name}</h2>
              <ul>
                {workout.exercises.map((exercise, idx) => (
                  <li key={idx}>
                    {exercise.name} ({exercise.scheme}) - Rest: {exercise.restBetweenSets}s / {exercise.restBetweenExercises}s
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default WorkoutsPage;