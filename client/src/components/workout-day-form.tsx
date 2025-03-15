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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Form schema with proper type coercion
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  exercises: z.array(z.object({
    exerciseId: z.coerce.number().min(1, "Exercise selection is required"),
    parameters: z.discriminatedUnion("scheme", [
      z.object({
        scheme: z.literal("STS"),
        minSets: z.coerce.number(),
        maxSets: z.coerce.number(),
        minReps: z.coerce.number(),
        maxReps: z.coerce.number(),
        restBetweenSets: z.coerce.number(),
        restBetweenExercises: z.coerce.number(),
      }),
      z.object({
        scheme: z.literal("Double Progression"),
        targetSets: z.coerce.number(),
        minReps: z.coerce.number(),
        maxReps: z.coerce.number(),
        restBetweenSets: z.coerce.number(),
        restBetweenExercises: z.coerce.number(),
      }),
      z.object({
        scheme: z.literal("RPT Top-Set"),
        sets: z.coerce.number(),
        minReps: z.coerce.number(),
        maxReps: z.coerce.number(),
        dropPercentages: z.array(z.coerce.number()),
        restBetweenSets: z.coerce.number(),
        restBetweenExercises: z.coerce.number(),
      }),
      z.object({
        scheme: z.literal("RPT Individual"),
        sets: z.coerce.number(),
        setConfigs: z.array(z.object({
          min: z.coerce.number(),
          max: z.coerce.number(),
        })),
        restBetweenSets: z.coerce.number(),
        restBetweenExercises: z.coerce.number(),
      }),
    ]),
  })).min(1, "At least one exercise is required"),
});

type FormData = z.infer<typeof formSchema>;

type SchemeType = FormData["exercises"][0]["parameters"]["scheme"];

const defaultParameters = {
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
      { min: 6, max: 8 },
      { min: 8, max: 10 },
      { min: 10, max: 12 }
    ],
    restBetweenSets: 180,
    restBetweenExercises: 240
  }
} as const;

interface WorkoutDayFormProps {
  onComplete?: () => void;
  workoutDay?: WorkoutDay;
}

export function WorkoutDayForm({ onComplete, workoutDay }: WorkoutDayFormProps) {
  const { toast } = useToast();
  const { data: exercises = [] } = useExercises();
  const isEditMode = Boolean(workoutDay);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: workoutDay ? {
      name: workoutDay.name,
      exercises: workoutDay.exercises
    } : {
      name: "",
      exercises: [{
        exerciseId: 0,
        parameters: defaultParameters.STS
      }]
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "exercises",
  });

  const workoutMutation = useMutation({
    mutationFn: async (data: FormData) => {
      console.log("[Workout Form] Submitting data:", JSON.stringify(data, null, 2));
      const method = isEditMode ? "PATCH" : "POST";
      const endpoint = isEditMode ? `/api/workout-days/${workoutDay?.id}` : "/api/workout-days";

      const response = await apiRequest(method, endpoint, data);
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
        description: `Workout day ${isEditMode ? 'updated' : 'created'} successfully`,
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

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!workoutDay) throw new Error("No workout day to delete");

      const response = await apiRequest("DELETE", `/api/workout-days/${workoutDay.id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || "Failed to delete workout");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-days"] });
      toast({
        title: "Success",
        description: "Workout day deleted successfully",
      });
      if (onComplete) {
        onComplete();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Cannot Delete Workout Day",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    console.log("[Workout Form] Form submitted with data:", JSON.stringify(data, null, 2));
    workoutMutation.mutate(data);
  };

  const handleSchemeChange = (value: SchemeType, index: number) => {
    console.log(`[Form] Changing scheme to ${value} for exercise ${index}`);
    // Reset the entire exercise parameters to default for the new scheme
    const newParameters = defaultParameters[value];
    console.log('[Form] New parameters:', newParameters);

    // Force a complete reset of the parameters
    form.setValue(`exercises.${index}`, {
      ...form.getValues(`exercises.${index}`),
      parameters: newParameters
    }, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex flex-col h-[calc(85vh-2rem)]">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-2xl font-bold">{isEditMode ? 'Edit' : 'Create'} Workout</h2>
            <Badge variant={isEditMode ? "secondary" : "default"}>
              {isEditMode ? 'Edit Mode' : 'Create Mode'}
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="space-y-4 p-4 border rounded-lg bg-card">
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
                          onValueChange={(value: SchemeType) => handleSchemeChange(value, index)}
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

                  {/* Show scheme-specific fields */}
                  {(() => {
                    const scheme = form.watch(`exercises.${index}.parameters.scheme`);
                    switch (scheme) {
                      case "STS":
                        return (
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
                        );

                      case "Double Progression":
                        return (
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
                        );

                      case "RPT Top-Set":
                        return (
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`exercises.${index}.parameters.sets`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Number of Sets</FormLabel>
                                  <FormControl>
                                    <Input type="number" {...field} onChange={(e) => {
                                      field.onChange(e);
                                      const sets = parseInt(e.target.value);
                                      form.setValue(`exercises.${index}.parameters.dropPercentages`,
                                        Array(sets).fill(0).map((_, i) => i === 0 ? 0 : 10)
                                      );
                                    }} />
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
                            {form.watch(`exercises.${index}.parameters.dropPercentages`)?.map((_, setIndex) => (
                              <FormField
                                key={setIndex}
                                control={form.control}
                                name={`exercises.${index}.parameters.dropPercentages.${setIndex}`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{setIndex === 0 ? "Top Set (0%)" : `Set ${setIndex + 1} Drop %`}</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        {...field}
                                        disabled={setIndex === 0}
                                        value={setIndex === 0 ? 0 : field.value}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                        );

                      case "RPT Individual":
                        return (
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`exercises.${index}.parameters.sets`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Number of Sets</FormLabel>
                                  <FormControl>
                                    <Input type="number" {...field} onChange={(e) => {
                                      field.onChange(e);
                                      const sets = parseInt(e.target.value);
                                      form.setValue(`exercises.${index}.parameters.setConfigs`,
                                        Array(sets).fill(0).map((_, i) => ({ min: 6, max: 8 }))
                                      );
                                    }} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            {form.watch(`exercises.${index}.parameters.setConfigs`)?.map((_, setIndex) => (
                              <div key={setIndex} className="col-span-2 grid grid-cols-2 gap-4 border p-2 rounded">
                                <FormField
                                  control={form.control}
                                  name={`exercises.${index}.parameters.setConfigs.${setIndex}.min`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Set {setIndex + 1} Min Reps</FormLabel>
                                      <FormControl>
                                        <Input type="number" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name={`exercises.${index}.parameters.setConfigs.${setIndex}.max`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Set {setIndex + 1} Max Reps</FormLabel>
                                      <FormControl>
                                        <Input type="number" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            ))}
                          </div>
                        );

                      default:
                        return null;
                    }
                  })()}

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
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => append({
                exerciseId: 0,
                parameters: defaultParameters.STS
              })}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Exercise
            </Button>
          </div>

          <div className="sticky bottom-0 border-t p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex gap-2 max-w-[600px] mx-auto">
              {isEditMode && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" className="flex-1">
                      Delete Workout
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete this workout day.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onComplete?.()}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                {isEditMode ? 'Update' : 'Create'} Workout
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}