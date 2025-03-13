import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { WorkoutLog, Exercise, WorkoutDay } from "@shared/schema";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Home, Trash2, PencilIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function WorkoutHistoryPage() {
  const { toast } = useToast();
  const [selectedLog, setSelectedLog] = useState<WorkoutLog | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Fetch workout logs
  const { data: workoutLogs = [], isLoading: logsLoading } = useQuery<WorkoutLog[]>({
    queryKey: ["/api/workout-logs"],
  });

  // Fetch exercises for reference
  const { data: exercises = [] } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
  });

  // Fetch workout days for reference
  const { data: workoutDays = [] } = useQuery<WorkoutDay[]>({
    queryKey: ["/api/workout-days"],
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (logId: number) => {
      const response = await apiRequest("DELETE", `/api/workout-logs/${logId}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Failed to delete workout log" }));
        throw new Error(error.message || "Failed to delete workout log");
      }
      return response.json().catch(() => ({})); // Handle empty response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-logs"] });
      toast({
        title: "Success",
        description: "Workout log deleted successfully",
      });
      setIsDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getExerciseName = (exerciseId: number) => {
    const exercise = exercises.find(e => e.id === exerciseId);
    return exercise?.name || "Unknown Exercise";
  };

  const getWorkoutDayName = (workoutDayId: number) => {
    const workoutDay = workoutDays.find(w => w.id === workoutDayId);
    return workoutDay?.name || "Unknown Workout";
  };

  if (logsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading workout history...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <nav className="border-b p-4">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Workout History</h1>
          <Link href="/">
            <Button variant="ghost" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Home
            </Button>
          </Link>
        </div>
      </nav>

      <div className="container mx-auto p-4">
        <div className="space-y-4">
          {workoutLogs.length === 0 ? (
            <Alert>
              <AlertDescription>
                No workout logs found. Complete a workout to see your history here.
              </AlertDescription>
            </Alert>
          ) : (
            workoutLogs
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((log) => (
                <Card key={log.id}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>{getWorkoutDayName(log.workoutDayId)}</CardTitle>
                      <CardDescription>
                        {format(new Date(log.date), "PPP")}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setSelectedLog(log);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {log.sets.map((exerciseSet, idx) => (
                        <div key={idx} className="space-y-2">
                          <h3 className="font-medium">
                            {getExerciseName(exerciseSet.exerciseId)}
                          </h3>
                          <div className="space-y-1">
                            {exerciseSet.sets.map((set, setIdx) => (
                              <p key={setIdx} className="text-sm text-muted-foreground">
                                Set {setIdx + 1}: {set.reps} reps @ {set.weight.toFixed(2)}kg
                              </p>
                            ))}
                            {exerciseSet.oneRm && (
                              <p className="text-sm font-medium mt-1">
                                1RM: {exerciseSet.oneRm.toFixed(2)}kg
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Workout Log</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this workout log? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => selectedLog?.id && deleteMutation.mutate(selectedLog.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}