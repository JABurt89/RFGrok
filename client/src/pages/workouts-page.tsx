import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { WorkoutDay, WorkoutLog } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Play } from "lucide-react";
import { Link } from "wouter";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import WorkoutDayForm from "@/components/workout-day-form";
import WorkoutLogger from "@/components/workout-logger";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function WorkoutsPage() {
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutDay | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutDay | null>(null);

  const { data: workoutDays = [] } = useQuery<WorkoutDay[]>({
    queryKey: ["/api/workout-days"],
  });

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Workouts</h1>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Workout
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Create Workout</SheetTitle>
              </SheetHeader>
              <WorkoutDayForm onComplete={() => setSelectedWorkout(null)} />
            </SheetContent>
          </Sheet>
        </div>

        {/* Workout List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workoutDays.map((workoutDay) => (
            <Card key={workoutDay.id}>
              <CardHeader>
                <CardTitle>{workoutDay.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  {workoutDay.exercises.length} exercise
                  {workoutDay.exercises.length !== 1 ? "s" : ""}
                </div>
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button onClick={() => setActiveWorkout(workoutDay)}>
                        <Play className="h-4 w-4 mr-2" />
                        Start
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <DialogHeader>
                        <DialogTitle>{workoutDay.name}</DialogTitle>
                      </DialogHeader>
                      {activeWorkout && (
                        <WorkoutLogger
                          workoutDay={activeWorkout}
                          onComplete={() => setActiveWorkout(null)}
                        />
                      )}
                    </DialogContent>
                  </Dialog>

                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={() => setSelectedWorkout(workoutDay)}
                      >
                        Edit
                      </Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>Edit Workout</SheetTitle>
                      </SheetHeader>
                      <WorkoutDayForm
                        workoutDay={workoutDay}
                        onComplete={() => setSelectedWorkout(null)}
                      />
                    </SheetContent>
                  </Sheet>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
