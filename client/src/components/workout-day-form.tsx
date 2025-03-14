import { useForm, useFieldArray } from "react-hook-form";
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
import { Plus, Trash2 } from "lucide-react";

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

interface RPTTopSetParameters {
  scheme: "RPT Top-Set";
  sets: number;
  minReps: number;
  maxReps: number;
  dropPercentages: number[];
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

type ExerciseParameters = STSParameters | DoubleProgressionParameters | RPTTopSetParameters | RPTIndividualParameters;

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
    scheme: "STS" as const,
    minSets: 3,
    maxSets: 4,
    minReps: 8,
    maxReps: 12,
    restBetweenSets: 90,
    restBetweenExercises: 180
  },
  "Double Progression": {
    scheme: "Double Progression" as const,
    targetSets: 3,
    minReps: 6,
    maxReps: 8,
    restBetweenSets: 90,
    restBetweenExercises: 180
  },
  "RPT Top-Set": {
    scheme: "RPT Top-Set" as const,
    sets: 3,
    minReps: 6,
    maxReps: 8,
    dropPercentages: [0, 10, 10],
    restBetweenSets: 180,
    restBetweenExercises: 240
  },
  "RPT Individual": {
    scheme: "RPT Individual" as const,
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

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "exercises",
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

          {fields.map((field, index) => (
            <div key={field.id} className="space-y-4 p-4 border rounded">
              <div className="flex items-center justify-between">
                <FormLabel>Exercise {index + 1}</FormLabel>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <FormField
                control={form.control}
                name={`exercises.${index}.exerciseId`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exercise</FormLabel>
                    <Select
                      value={field.value.toString()}
                      onValueChange={(value) => field.onChange(parseInt(value))}
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`exercises.${index}.parameters.scheme`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Progression Scheme</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        form.setValue(`exercises.${index}.parameters`, defaultParameters[value]);
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch(`exercises.${index}.parameters.scheme`) === "STS" && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`exercises.${index}.parameters.minSets`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Sets</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`exercises.${index}.parameters.maxSets`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Sets</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              {form.watch(`exercises.${index}.parameters.scheme`) === "Double Progression" && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`exercises.${index}.parameters.targetSets`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Sets</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`exercises.${index}.parameters.minReps`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Reps</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`exercises.${index}.parameters.maxReps`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Reps</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              {form.watch(`exercises.${index}.parameters.scheme`) === "RPT Top-Set" && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name={`exercises.${index}.parameters.sets`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Sets</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={2}
                            {...field}
                            onChange={(e) => {
                              const newSets = parseInt(e.target.value);
                              const currentParams = form.getValues(`exercises.${index}.parameters`);
                              const newDropPercentages = Array(newSets).fill(0).map((_, i) =>
                                i === 0 ? 0 : currentParams.dropPercentages?.[i] || 10
                              );
                              form.setValue(`exercises.${index}.parameters.dropPercentages`, newDropPercentages);
                              field.onChange(newSets);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`exercises.${index}.parameters.minReps`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Min Reps</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`exercises.${index}.parameters.maxReps`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Reps</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <FormLabel>Drop Percentages</FormLabel>
                    {Array.from({ length: form.watch(`exercises.${index}.parameters.sets`) || 0 }).map((_, setIdx) => (
                      <FormField
                        key={setIdx}
                        control={form.control}
                        name={`exercises.${index}.parameters.dropPercentages.${setIdx}`}
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center gap-2">
                              <FormLabel className="w-16">Set {setIdx + 1}:</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  disabled={setIdx === 0}
                                  {...field}
                                />
                              </FormControl>
                              <span className="text-sm">%</span>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
              {form.watch(`exercises.${index}.parameters.scheme`) === "RPT Individual" && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name={`exercises.${index}.parameters.sets`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Sets</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            {...field}
                            onChange={(e) => {
                              const newSets = parseInt(e.target.value);
                              const currentParams = form.getValues(`exercises.${index}.parameters`);
                              const newSetConfigs = Array(newSets).fill(0).map((_, i) =>
                                currentParams.setConfigs?.[i] || { min: 6, max: 8 }
                              );
                              form.setValue(`exercises.${index}.parameters.setConfigs`, newSetConfigs);
                              field.onChange(newSets);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2">
                    <FormLabel>Set Configurations</FormLabel>
                    {Array.from({ length: form.watch(`exercises.${index}.parameters.sets`) || 0 }).map((_, setIdx) => (
                      <div key={setIdx} className="border rounded p-2 space-y-2">
                        <FormLabel>Set {setIdx + 1}</FormLabel>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name={`exercises.${index}.parameters.setConfigs.${setIdx}.min`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Min Reps</FormLabel>
                                <FormControl>
                                  <Input type="number" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`exercises.${index}.parameters.setConfigs.${setIdx}.max`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Max Reps</FormLabel>
                                <FormControl>
                                  <Input type="number" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}


              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name={`exercises.${index}.parameters.restBetweenSets`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rest Between Sets (s)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`exercises.${index}.parameters.restBetweenExercises`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rest Between Exercises (s)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => append({
              exerciseId: 0,
              parameters: defaultParameters["STS"]
            })}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Exercise
          </Button>
        </div>

        <div className="sticky bottom-0 pt-4 bg-background border-t">
          <Button type="submit" className="w-full">
            {workoutDay ? 'Save Changes' : 'Create Workout'}
          </Button>
        </div>
      </form>
    </Form>
  );
}