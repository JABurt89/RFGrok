```typescript
import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Timer } from "lucide-react";

export interface BaseWorkoutLoggerProps {
  exerciseId: number;
  workoutDayId: number;
  onComplete: () => void;
  totalExercises?: number;
}

export interface WorkoutSet {
  reps: number;
  weight: number;
  timestamp: string;
  isFailure?: boolean;
  exceededMax?: boolean;
}

export function BaseWorkoutLogger({ exerciseId, workoutDayId, onComplete, totalExercises = 3 }: BaseWorkoutLoggerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [currentSet, setCurrentSet] = useState(0);
  const [loggedSets, setLoggedSets] = useState<WorkoutSet[]>([]);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [workoutLogId, setWorkoutLogId] = useState<number | null>(null);

  // Fetch exercises for reference
  const { data: exercises = [] } = useQuery({
    queryKey: ["/api/exercises"],
  });

  // Get exercise name
  const getExerciseName = () => {
    const exercise = exercises.find(e => e.id === exerciseId);
    return exercise?.name || "Exercise";
  };

  // Rest timer effect
  useEffect(() => {
    let interval: number;
    if (restTimer !== null && restTimer > 0) {
      interval = window.setInterval(() => {
        setRestTimer(prev => {
          if (prev === null || prev <= 0) return null;
          return prev - 1;
        });
      }, 1000);

      // Play sound when timer reaches 0
      if (restTimer === 1) {
        new Audio('/chime.mp3').play().catch(console.error);
      }
    }
    return () => window.clearInterval(interval);
  }, [restTimer]);

  if (!user) {
    return (
      <Alert>
        <AlertDescription>Please log in to view workout suggestions.</AlertDescription>
      </Alert>
    );
  }

  // Rest Timer Component
  const RestTimer = () => {
    if (restTimer === null || restTimer <= 0) return null;
    
    return (
      <Alert>
        <AlertDescription className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            <span>Rest Time: {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, '0')}</span>
          </div>
        </AlertDescription>
      </Alert>
    );
  };

  return {
    isWorkoutActive,
    setIsWorkoutActive,
    currentSet,
    setCurrentSet,
    loggedSets,
    setLoggedSets,
    restTimer,
    setRestTimer,
    workoutLogId,
    setWorkoutLogId,
    getExerciseName,
    RestTimer,
    queryClient,
    toast,
    user,
    exercises
  };
}
```
