import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Exercise } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import ExerciseForm from "@/components/exercise-form";
import { Badge } from "@/components/ui/badge";

export default function ExercisesPage() {
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const { data: exercises = [], isLoading } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
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
            <h1 className="text-2xl font-bold">Exercises</h1>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Exercise
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Create Exercise</SheetTitle>
              </SheetHeader>
              <ExerciseForm onComplete={() => setSelectedExercise(null)} />
            </SheetContent>
          </Sheet>
        </div>

        {/* Exercise List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {exercises.map((exercise) => (
            <Card key={exercise.id} className="relative">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{exercise.name}</span>
                  {exercise.isArchived && (
                    <Badge variant="secondary">[Archived]</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedExercise(exercise)}
                    >
                      Edit
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Edit Exercise</SheetTitle>
                    </SheetHeader>
                    <ExerciseForm
                      exercise={exercise}
                      onComplete={() => setSelectedExercise(null)}
                    />
                  </SheetContent>
                </Sheet>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
