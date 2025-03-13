import { useForm } from "react-hook-form";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Exercise } from "@/types";
import { useExercises } from "@/hooks/useExercises";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface WorkoutDayFormProps {
  submitWorkoutDay: (data: Partial<WorkoutDay>) => void;
}

interface STSParameters {
  scheme: "STS";
  minSets: number;
  maxSets: number;
  minReps: number;
  maxReps: number;
  restBetweenSets: number;
  restBetweenExercises: number;
}

interface DoubleProgressionParameters {
  scheme: "Double Progression";
  targetSets: number;
  minReps: number;
  maxReps: number;
  restBetweenSets: number;
  restBetweenExercises: number;
}

interface RPTParameters {
  scheme: "RPT Top-Set" | "RPT Individual";
  targetReps: number;
  dropPercent: number;
  restBetweenSets: number;
  restBetweenExercises: number;
}

type ExerciseParameters = STSParameters | DoubleProgressionParameters | RPTParameters;

interface WorkoutExercise {
  exerciseId: number;
  parameters: ExerciseParameters;
}

interface WorkoutDayFormData {
  name: string;
  exercises: WorkoutExercise[];
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  exercises: z.array(z.object({
    exerciseId: z.number().min(1, "Exercise selection is required"),
    parameters: z.union([
      z.object({
        scheme: z.literal("STS"),
        minSets: z.number(),
        maxSets: z.number(),
        minReps: z.number(),
        maxReps: z.number(),
        restBetweenSets: z.number(),
        restBetweenExercises: z.number(),
      }),
      z.object({
        scheme: z.literal("Double Progression"),
        targetSets: z.number(),
        minReps: z.number(),
        maxReps: z.number(),
        restBetweenSets: z.number(),
        restBetweenExercises: z.number(),
      }),
      z.object({
        scheme: z.union([z.literal("RPT Top-Set"), z.literal("RPT Individual")]),
        targetReps: z.number(),
        dropPercent: z.number(),
        restBetweenSets: z.number(),
        restBetweenExercises: z.number(),
      }),
    ]),
  })),
});

const defaultParameters: Record<string, ExerciseParameters> = {
  "STS": {
    scheme: "STS",
    minSets: 3,
    maxSets: 4,
    minReps: 8,
    maxReps: 12,
    restBetweenSets: 90,
    restBetweenExercises: 180
  },
  "Double Progression": {
    scheme: "Double Progression",
    targetSets: 3,
    minReps: 6,
    maxReps: 8,
    restBetweenSets: 90,
    restBetweenExercises: 180
  },
  "RPT Top-Set": {
    scheme: "RPT Top-Set",
    targetReps: 6,
    dropPercent: 10,
    restBetweenSets: 180,
    restBetweenExercises: 240
  },
  "RPT Individual": {
    scheme: "RPT Individual",
    targetReps: 6,
    dropPercent: 10,
    restBetweenSets: 180,
    restBetweenExercises: 240
  }
};

export function WorkoutDayForm({ submitWorkoutDay }: WorkoutDayFormProps) {
  const { data: exercises = [] } = useExercises();

  const form = useForm<WorkoutDayFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      exercises: [{
        exerciseId: 0,
        parameters: defaultParameters["STS"]
      }]
    },
  });

  const onSubmit = (data: WorkoutDayFormData) => {
    console.log("Form submitted with data:", data);
    submitWorkoutDay(data);
  };

  const renderParameterFields = (index: number, scheme: string) => {
    const currentExercise = form.getValues("exercises")[index];
    const currentParameters = currentExercise.parameters;

    switch (scheme) {
      case "STS": {
        const stsParams = currentParameters as STSParameters;
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
                    exercises[index].parameters = {
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
                    exercises[index].parameters = {
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
                    exercises[index].parameters = {
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
                    exercises[index].parameters = {
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
        const dpParams = currentParameters as DoubleProgressionParameters;
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Target Sets</label>
              <Input
                type="number"
                value={dpParams.targetSets}
                onChange={(e) => {
                  const exercises = [...form.getValues("exercises")];
                  exercises[index].parameters = {
                    ...dpParams,
                    targetSets: parseInt(e.target.value)
                  };
                  form.setValue("exercises", exercises);
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Min Reps</label>
                <Input
                  type="number"
                  value={dpParams.minReps}
                  onChange={(e) => {
                    const exercises = [...form.getValues("exercises")];
                    exercises[index].parameters = {
                      ...dpParams,
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
                  value={dpParams.maxReps}
                  onChange={(e) => {
                    const exercises = [...form.getValues("exercises")];
                    exercises[index].parameters = {
                      ...dpParams,
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
      case "RPT Top-Set":
      case "RPT Individual": {
        const rptParams = currentParameters as RPTParameters;
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Target Reps</label>
              <Input
                type="number"
                value={rptParams.targetReps}
                onChange={(e) => {
                  const exercises = [...form.getValues("exercises")];
                  exercises[index].parameters = {
                    ...rptParams,
                    targetReps: parseInt(e.target.value)
                  };
                  form.setValue("exercises", exercises);
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Drop Percentage</label>
              <Input
                type="number"
                value={rptParams.dropPercent}
                onChange={(e) => {
                  const exercises = [...form.getValues("exercises")];
                  exercises[index].parameters = {
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Workout Name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g., Push Day A" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                value={exercise.parameters.scheme}
                onValueChange={(value) => {
                  const exercises = [...form.getValues("exercises")];
                  exercises[index].parameters = defaultParameters[value];
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

            {renderParameterFields(index, exercise.parameters.scheme)}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Rest Between Sets (s)</label>
                <Input
                  type="number"
                  value={exercise.parameters.restBetweenSets}
                  onChange={(e) => {
                    const exercises = [...form.getValues("exercises")];
                    exercises[index].parameters = {
                      ...exercise.parameters,
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
                  value={exercise.parameters.restBetweenExercises}
                  onChange={(e) => {
                    const exercises = [...form.getValues("exercises")];
                    exercises[index].parameters = {
                      ...exercise.parameters,
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
              parameters: defaultParameters["STS"]
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
    </Form>
  );
}