import { useForm, useFieldArray } from "react-hook-form";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Exercise } from "@/types";
import { useExercises } from "@/hooks/useExercises";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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

interface WorkoutDayFormProps {
  onComplete?: () => void;
}

export function WorkoutDayForm({ onComplete }: WorkoutDayFormProps) {
  const { toast } = useToast();
  const { data: exercises = [] } = useExercises();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      exercises: [{
        exerciseId: 0,
        parameters: {
          scheme: "STS",
          minSets: 3,
          maxSets: 4,
          minReps: 8,
          maxReps: 12,
          restBetweenSets: 90,
          restBetweenExercises: 180
        }
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
      const response = await apiRequest("POST", "/api/workout-days", data);
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
        description: "Workout day created successfully",
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

  const onSubmit = (data: FormData) => {
    console.log("[Workout Form] Form submitted with data:", JSON.stringify(data, null, 2));
    workoutMutation.mutate(data);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Create Workout</h2>
        <Badge variant="default">Create Mode</Badge>
      </div>

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
                      onValueChange={(value: FormData["exercises"][0]["parameters"]["scheme"]) => {
                        // Set default values based on scheme
                        let defaultParams;
                        switch (value) {
                          case "STS":
                            defaultParams = {
                              scheme: "STS",
                              minSets: 3,
                              maxSets: 4,
                              minReps: 8,
                              maxReps: 12,
                              restBetweenSets: 90,
                              restBetweenExercises: 180
                            };
                            break;
                          case "Double Progression":
                            defaultParams = {
                              scheme: "Double Progression",
                              targetSets: 3,
                              minReps: 6,
                              maxReps: 8,
                              restBetweenSets: 90,
                              restBetweenExercises: 180
                            };
                            break;
                          case "RPT Top-Set":
                            defaultParams = {
                              scheme: "RPT Top-Set",
                              sets: 3,
                              minReps: 6,
                              maxReps: 8,
                              dropPercentages: [0, 10, 10],
                              restBetweenSets: 180,
                              restBetweenExercises: 240
                            };
                            break;
                          case "RPT Individual":
                            defaultParams = {
                              scheme: "RPT Individual",
                              sets: 3,
                              setConfigs: [
                                { min: 6, max: 8 },
                                { min: 8, max: 10 },
                                { min: 10, max: 12 }
                              ],
                              restBetweenSets: 180,
                              restBetweenExercises: 240
                            };
                            break;
                        }
                        form.setValue(`exercises.${index}.parameters`, defaultParams);
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

              {/* Scheme-specific parameters */}
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

              {/* Rest period fields (common to all schemes) */}
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
              parameters: {
                scheme: "STS",
                minSets: 3,
                maxSets: 4,
                minReps: 8,
                maxReps: 12,
                restBetweenSets: 90,
                restBetweenExercises: 180
              }
            })}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Exercise
          </Button>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onComplete?.()}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Create Workout
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}