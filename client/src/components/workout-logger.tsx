import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, PauseCircle } from "lucide-react";

interface WorkoutLoggerProps {
  exerciseId: number;
  onComplete: () => void;
}

export default function WorkoutLogger({ exerciseId, onComplete }: WorkoutLoggerProps) {
  const { toast } = useToast();
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [currentSet, setCurrentSet] = useState(0);
  const [loggedReps, setLoggedReps] = useState<number[]>([]);
  const [restTimer, setRestTimer] = useState<number | null>(null);

  // Fetch workout suggestion
  const { data: suggestion, isLoading, error } = useQuery({
    queryKey: ['/api/workout-suggestion', exerciseId],
    queryFn: () => 
      apiRequest("GET", `/api/workout-suggestion?exerciseId=${exerciseId}`)
        .then(res => {
          if (!res.ok) {
            throw new Error('Failed to fetch workout suggestion');
          }
          return res.json();
        }),
    enabled: !!exerciseId, // Only run query if exerciseId is provided
  });

  // Handle workout start
  const handleStartWorkout = () => {
    if (!suggestion) {
      toast({
        title: "Error",
        description: "No workout suggestion available",
        variant: "destructive"
      });
      return;
    }
    setIsWorkoutActive(true);
  };

  // Log reps for current set
  const logReps = (reps: number) => {
    setLoggedReps(prev => [...prev, reps]);
    setCurrentSet(prev => prev + 1);
    setRestTimer(90); // Start 90 second rest timer

    // Play sound when rest timer starts
    try {
      const audio = new Audio("/notification.mp3");
      audio.play().catch(console.error);
    } catch (error) {
      console.error("Error playing notification sound:", error);
    }
  };

  // Rest timer effect
  useEffect(() => {
    let interval: number;
    if (restTimer !== null && restTimer > 0) {
      interval = window.setInterval(() => {
        setRestTimer(prev => (prev ?? 0) - 1);
      }, 1000);

      // Play sound when rest timer ends
      if (restTimer === 1) {
        try {
          const audio = new Audio("/notification.mp3");
          audio.play().catch(console.error);
        } catch (error) {
          console.error("Error playing notification sound:", error);
        }
      }
    }
    return () => window.clearInterval(interval);
  }, [restTimer]);

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Error loading workout suggestion. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  // Active workout view
  if (isWorkoutActive) {
    return (
      <div className="space-y-4">
        {restTimer !== null && restTimer > 0 && (
          <Alert>
            <AlertDescription className="flex items-center justify-between">
              <span>Rest Time: {restTimer}s</span>
              <PauseCircle className="h-5 w-5 animate-pulse" />
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Logging Set {currentSet + 1}</CardTitle>
            <CardDescription>
              Target: {suggestion?.weight}kg × {suggestion?.reps} reps
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Input 
                type="number" 
                placeholder="Enter reps completed"
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value)) {
                    logReps(value);
                  }
                }}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {loggedReps.map((reps, index) => (
                <div key={index} className="mt-2">
                  Set {index + 1}: {reps} reps @ {suggestion?.weight}kg
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={onComplete}>
              End Workout
            </Button>
            {currentSet >= (suggestion?.sets || 0) && (
              <Button onClick={onComplete}>Complete Workout</Button>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Setup view
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Workout Setup</CardTitle>
          <CardDescription>
            {isLoading ? "Loading suggestion..." : "Review and start your workout"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading...</span>
            </div>
          ) : suggestion ? (
            <div className="space-y-2">
              <div className="p-4 rounded-md bg-muted">
                <p className="text-lg font-medium">
                  {suggestion.sets} sets × {suggestion.reps} reps @ {suggestion.weight}kg
                </p>
                {suggestion.calculated1RM && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Estimated 1RM: {suggestion.calculated1RM}kg
                  </p>
                )}
              </div>
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                No workout suggestion available
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full" 
            onClick={handleStartWorkout}
            disabled={!suggestion}
          >
            Start Workout
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}