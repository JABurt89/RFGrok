import { useForm } from "react-hook-form";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Exercise, WorkoutDay } from "@/types";
import { useExercises } from "@/hooks/useExercises";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface WorkoutDayFormProps {
  submitWorkoutDay?: (data: Partial<WorkoutDay>) => void;
  workoutDay?: WorkoutDay;
  onComplete?: () => void;
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
  sets: number;
  targetReps: number;
  minReps: number;
  maxReps: number;
  dropPercentages: number[]; // Array of drop percentages for each set
  restBetweenSets: number;
  restBetweenExercises: number;
}

interface RPTIndividualParameters {
  scheme: "RPT Individual";
  sets: number;
  setConfigs: Array<{
    min: number;
    max: number;
  }>;
  restBetweenSets: number;
  restBetweenExercises: number;
}

type ExerciseParameters = STSParameters | DoubleProgressionParameters | RPTParameters | RPTIndividualParameters;

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
    parameters: z.discriminatedUnion("scheme", [
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
        scheme: z.literal("RPT Top-Set"),
        sets: z.number().min(2, "At least 2 sets required"),
        minReps: z.number(),
        maxReps: z.number(),
        dropPercentages: z.array(z.number()),
        restBetweenSets: z.number(),
        restBetweenExercises: z.number(),
      }),
      z.object({
        scheme: z.literal("RPT Individual"),
        sets: z.number().min(1, "At least 1 set required"),
        setConfigs: z.array(z.object({
          min: z.number(),
          max: z.number(),
        })),
        restBetweenSets: z.number(),
        restBetweenExercises: z.number(),
      }),
    ]),
  })),
});

const defaultParameters: Record<string, any> = {
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
    sets: 3,
    minReps: 6,
    maxReps: 8,
    dropPercentages: [0, 10, 10], // First set is top set (0% drop), subsequent sets drop by 10%
    restBetweenSets: 180,
    restBetweenExercises: 240
  },
  "RPT Individual": {
    scheme: "RPT Individual",
    sets: 3,
    setConfigs: [
      { min: 5, max: 7 },
      { min: 6, max: 8 },
      { min: 7, max: 9 }
    ],
    restBetweenSets: 180,
    restBetweenExercises: 240
  }
};

export function WorkoutDayForm({ workoutDay, onComplete }: WorkoutDayFormProps) {
  const { toast } = useToast();
  const { data: exercises = [] } = useExercises();

  const form = useForm<WorkoutDayFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: workoutDay
      ? {
          name: workoutDay.name,
          exercises: workoutDay.exercises,
        }
      : {
          name: "",
          exercises: [{
            exerciseId: 0,
            parameters: defaultParameters["STS"]
          }]
        },
  });

  const workoutMutation = useMutation({
    mutationFn: async (data: Partial<WorkoutDay>) => {
      const method = workoutDay?.id ? "PATCH" : "POST";
      const url = workoutDay?.id 
        ? `/api/workout-days/${workoutDay.id}`
        : "/api/workout-days";

      const response = await apiRequest(method, url, data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save workout");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-days"] });
      toast({
        title: "Success",
        description: `Workout day ${workoutDay?.id ? 'updated' : 'created'} successfully`,
      });
      if (onComplete) {
        onComplete();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: WorkoutDayFormData) => {
    console.log("Form submitted with data:", data);
    workoutMutation.mutate(data);
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
      case "RPT Top-Set": {
        const rptParams = currentParameters as typeof defaultParameters["RPT Top-Set"];
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Number of Sets</label>
              <Input
                type="number"
                min={2}
                value={rptParams.sets}
                onChange={(e) => {
                  const newSets = parseInt(e.target.value);
                  const exercises = [...form.getValues("exercises")];
                  const newDropPercentages = Array(newSets).fill(0).map((_, i) =>
                    i === 0 ? 0 : rptParams.dropPercentages[i] || 10
                  );
                  exercises[index].parameters = {
                    ...rptParams,
                    sets: newSets,
                    dropPercentages: newDropPercentages
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
                  value={rptParams.minReps}
                  onChange={(e) => {
                    const exercises = [...form.getValues("exercises")];
                    exercises[index].parameters = {
                      ...rptParams,
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
                  value={rptParams.maxReps}
                  onChange={(e) => {
                    const exercises = [...form.getValues("exercises")];
                    exercises[index].parameters = {
                      ...rptParams,
                      maxReps: parseInt(e.target.value)
                    };
                    form.setValue("exercises", exercises);
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Drop Percentages</label>
              {Array(rptParams.sets).fill(0).map((_, setIndex) => (
                <div key={setIndex} className="flex items-center gap-2">
                  <span className="text-sm">Set {setIndex + 1}:</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={rptParams.dropPercentages[setIndex]}
                    disabled={setIndex === 0}
                    onChange={(e) => {
                      const exercises = [...form.getValues("exercises")];
                      const newDropPercentages = [...rptParams.dropPercentages];
                      newDropPercentages[setIndex] = parseInt(e.target.value);
                      exercises[index].parameters = {
                        ...rptParams,
                        dropPercentages: newDropPercentages
                      };
                      form.setValue("exercises", exercises);
                    }}
                  />
                  <span className="text-sm">%</span>
                </div>
              ))}
            </div>
          </div>
        );
      }
      case "RPT Individual": {
        const rptParams = currentParameters as typeof defaultParameters["RPT Individual"];
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Number of Sets</label>
              <Input
                type="number"
                min={1}
                value={rptParams.sets}
                onChange={(e) => {
                  const newSets = parseInt(e.target.value);
                  const exercises = [...form.getValues("exercises")];
                  const newSetConfigs = Array(newSets).fill(0).map((_, i) =>
                    rptParams.setConfigs[i] || { min: 6, max: 8 }
                  );
                  exercises[index].parameters = {
                    ...rptParams,
                    sets: newSets,
                    setConfigs: newSetConfigs
                  };
                  form.setValue("exercises", exercises);
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Set Configurations</label>
              {Array(rptParams.sets).fill(0).map((_, setIndex) => (
                <div key={setIndex} className="border rounded p-2 space-y-2">
                  <div className="text-sm font-medium">Set {setIndex + 1}</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm">Min Reps</label>
                      <Input
                        type="number"
                        value={rptParams.setConfigs[setIndex].min}
                        onChange={(e) => {
                          const exercises = [...form.getValues("exercises")];
                          const newSetConfigs = [...rptParams.setConfigs];
                          newSetConfigs[setIndex] = {
                            ...newSetConfigs[setIndex],
                            min: parseInt(e.target.value)
                          };
                          exercises[index].parameters = {
                            ...rptParams,
                            setConfigs: newSetConfigs
                          };
                          form.setValue("exercises", exercises);
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm">Max Reps</label>
                      <Input
                        type="number"
                        value={rptParams.setConfigs[setIndex].max}
                        onChange={(e) => {
                          const exercises = [...form.getValues("exercises")];
                          const newSetConfigs = [...rptParams.setConfigs];
                          newSetConfigs[setIndex] = {
                            ...newSetConfigs[setIndex],
                            max: parseInt(e.target.value)
                          };
                          exercises[index].parameters = {
                            ...rptParams,
                            setConfigs: newSetConfigs
                          };
                          form.setValue("exercises", exercises);
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 h-[calc(100vh-8rem)]">
        <div className="space-y-4 overflow-y-auto h-[calc(100%-4rem)] pb-4">
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
        </div>

        <div className="sticky bottom-0 pt-4 bg-background border-t">
          <Button type="submit" className="w-full">
            Create Workout
          </Button>
        </div>
      </form>
    </Form>
  );
}