import { useForm } from "react-hook-form";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Exercise } from "../types";
import { useExercises } from "../hooks/useExercises";

interface WorkoutDayFormProps {
  onSubmit: (data: WorkoutDayFormData) => void;
}

interface ProgressionParameters {
  sets: number;
  reps: number;
  restBetweenSets: number;
  restBetweenExercises: number;
}

interface STSParameters extends ProgressionParameters {
  scheme: "STS";
  minSets: number;
  maxSets: number;
  minReps: number;
  maxReps: number;
}

interface DoubleProgressionParameters extends ProgressionParameters {
  scheme: "Double Progression";
  targetSets: number;
}

interface RPTParameters extends ProgressionParameters {
  scheme: "RPT Top-Set" | "RPT Individual";
  dropPercent: number;
}

type SchemeParameters = STSParameters | DoubleProgressionParameters | RPTParameters;

interface WorkoutExercise {
  exerciseId: number;
  progression: SchemeParameters;
}

interface WorkoutDayFormData {
  name: string;
  exercises: WorkoutExercise[];
}

const defaultProgressionParameters: Record<string, SchemeParameters> = {
  "STS": {
    scheme: "STS",
    minSets: 3,
    maxSets: 4,
    minReps: 8,
    maxReps: 12,
    sets: 3,
    reps: 10,
    restBetweenSets: 90,
    restBetweenExercises: 180
  },
  "Double Progression": {
    scheme: "Double Progression",
    targetSets: 3,
    sets: 3,
    reps: 8,
    restBetweenSets: 90,
    restBetweenExercises: 180
  },
  "RPT Top-Set": {
    scheme: "RPT Top-Set",
    sets: 3,
    reps: 6,
    dropPercent: 10,
    restBetweenSets: 180,
    restBetweenExercises: 240
  },
  "RPT Individual": {
    scheme: "RPT Individual",
    sets: 3,
    reps: 6,
    dropPercent: 10,
    restBetweenSets: 180,
    restBetweenExercises: 240
  }
};

export function WorkoutDayForm({ onSubmit }: WorkoutDayFormProps) {
  const { exercises } = useExercises();
  const form = useForm<WorkoutDayFormData>({
    defaultValues: {
      name: "",
      exercises: [{
        exerciseId: 0,
        progression: defaultProgressionParameters["STS"]
      }]
    },
  });

  const renderProgressionFields = (index: number, scheme: string) => {
    const currentExercise = form.getValues("exercises")[index];
    const currentProgression = currentExercise.progression;

    switch (scheme) {
      case "STS": {
        const stsParams = currentProgression as STSParameters;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Min Sets</label>
                <Input
                  type="number"
                  value={stsParams.minSets}
                  onChange={(e) => {
                    const exercises = [...form.getValues("exercises")];
                    exercises[index].progression = {
                      ...stsParams,
                      minSets: parseInt(e.target.value)
                    };
                    form.setValue("exercises", exercises);
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Max Sets</label>
                <Input
                  type="number"
                  value={stsParams.maxSets}
                  onChange={(e) => {
                    const exercises = [...form.getValues("exercises")];
                    exercises[index].progression = {
                      ...stsParams,
                      maxSets: parseInt(e.target.value)
                    };
                    form.setValue("exercises", exercises);
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Min Reps</label>
                <Input
                  type="number"
                  value={stsParams.minReps}
                  onChange={(e) => {
                    const exercises = [...form.getValues("exercises")];
                    exercises[index].progression = {
                      ...stsParams,
                      minReps: parseInt(e.target.value)
                    };
                    form.setValue("exercises", exercises);
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Max Reps</label>
                <Input
                  type="number"
                  value={stsParams.maxReps}
                  onChange={(e) => {
                    const exercises = [...form.getValues("exercises")];
                    exercises[index].progression = {
                      ...stsParams,
                      maxReps: parseInt(e.target.value)
                    };
                    form.setValue("exercises", exercises);
                  }}
                />
              </div>
            </div>
          </div>
        );
      }
      case "Double Progression": {
        const dpParams = currentProgression as DoubleProgressionParameters;
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Target Sets</label>
              <Input
                type="number"
                value={dpParams.targetSets}
                onChange={(e) => {
                  const exercises = [...form.getValues("exercises")];
                  exercises[index].progression = {
                    ...dpParams,
                    targetSets: parseInt(e.target.value)
                  };
                  form.setValue("exercises", exercises);
                }}
              />
            </div>
          </div>
        );
      }
      case "RPT Top-Set":
      case "RPT Individual": {
        const rptParams = currentProgression as RPTParameters;
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Drop Percentage</label>
              <Input
                type="number"
                value={rptParams.dropPercent}
                onChange={(e) => {
                  const exercises = [...form.getValues("exercises")];
                  exercises[index].progression = {
                    ...rptParams,
                    dropPercent: parseInt(e.target.value)
                  };
                  form.setValue("exercises", exercises);
                }}
              />
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Workout Name</label>
        <Input
          {...form.register("name", { required: true })}
          placeholder="e.g., Push Day A"
        />
      </div>

      {form.watch("exercises").map((exercise, index) => (
        <div key={index} className="space-y-4 p-4 border rounded">
          <div>
            <label className="block text-sm font-medium">Exercise</label>
            <Select
              value={exercise.exerciseId.toString()}
              onValueChange={(value) => {
                const exercises = [...form.getValues("exercises")];
                exercises[index].exerciseId = parseInt(value);
                form.setValue("exercises", exercises);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an exercise" />
              </SelectTrigger>
              <SelectContent>
                {exercises.map((e) => (
                  <SelectItem key={e.id} value={e.id.toString()}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium">Progression Scheme</label>
            <Select
              value={exercise.progression.scheme}
              onValueChange={(value) => {
                const exercises = [...form.getValues("exercises")];
                exercises[index].progression = defaultProgressionParameters[value];
                form.setValue("exercises", exercises);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select progression scheme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STS">Straight Sets (STS)</SelectItem>
                <SelectItem value="Double Progression">Double Progression</SelectItem>
                <SelectItem value="RPT Top-Set">RPT Top-Set</SelectItem>
                <SelectItem value="RPT Individual">RPT Individual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {renderProgressionFields(index, exercise.progression.scheme)}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Rest Between Sets (s)</label>
              <Input
                type="number"
                value={exercise.progression.restBetweenSets}
                onChange={(e) => {
                  const exercises = [...form.getValues("exercises")];
                  exercises[index].progression = {
                    ...exercise.progression,
                    restBetweenSets: parseInt(e.target.value)
                  };
                  form.setValue("exercises", exercises);
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Rest Between Exercises (s)</label>
              <Input
                type="number"
                value={exercise.progression.restBetweenExercises}
                onChange={(e) => {
                  const exercises = [...form.getValues("exercises")];
                  exercises[index].progression = {
                    ...exercise.progression,
                    restBetweenExercises: parseInt(e.target.value)
                  };
                  form.setValue("exercises", exercises);
                }}
              />
            </div>
          </div>

          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              const exercises = [...form.getValues("exercises")];
              exercises.splice(index, 1);
              form.setValue("exercises", exercises);
            }}
          >
            Remove Exercise
          </Button>
        </div>
      ))}

      <Button
        type="button"
        onClick={() => {
          const exercises = [...form.getValues("exercises")];
          exercises.push({
            exerciseId: 0,
            progression: defaultProgressionParameters["STS"]
          });
          form.setValue("exercises", exercises);
        }}
      >
        Add Exercise
      </Button>

      <Button type="submit" className="w-full">
        Create Workout
      </Button>
    </form>
  );
}