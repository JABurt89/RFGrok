import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { 
  ProgressionScheme, 
  progressionSchemes,
  defaultProgressionParameters,
  WorkoutExercise,
  STSParameters,
  DoubleProgressionParameters,
  RPTTopSetParameters,
  RPTIndividualParameters,
  Exercise
} from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";

type WorkoutDayFormProps = {
  workoutDay?: WorkoutDay;
  onSubmit: (data: WorkoutDayFormData) => void;
};

type WorkoutDayFormData = {
  name: string;
  exercises: WorkoutExercise[];
};

export function WorkoutDayForm({ workoutDay, onSubmit }: WorkoutDayFormProps) {
  // Fetch exercises
  const { data: exercises = [] } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
  });

  const form = useForm<WorkoutDayFormData>({
    defaultValues: workoutDay ?? {
      name: "",
      exercises: [
        {
          exerciseId: 0,
          parameters: defaultProgressionParameters["STS"],
        },
      ],
    },
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(form.getValues("exercises"));
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    form.setValue("exercises", items);
  };

  const handleExerciseSelect = (index: number, exerciseId: number) => {
    const exercise = exercises.find(e => e.id === exerciseId);
    if (!exercise) return;

    const currentExercises = form.getValues("exercises");
    const currentScheme = currentExercises[index]?.parameters.scheme ?? "STS";

    form.setValue(`exercises.${index}`, {
      exerciseId,
      parameters: defaultProgressionParameters[currentScheme]
    });
  };

  const renderSchemeParameters = (index: number, scheme: ProgressionScheme) => {
    const exercises = form.getValues("exercises");
    const exercise = exercises[index];
    const parameters = exercise?.parameters ?? defaultProgressionParameters[scheme];

    switch (scheme) {
      case "STS": {
        const stsParams = parameters as STSParameters;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Min Sets</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={stsParams.minSets}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...stsParams,
                        minSets: parseInt(e.target.value),
                      };
                      form.setValue("exercises", exercises);
                    }}
                  />
                </FormControl>
              </FormItem>
              <FormItem>
                <FormLabel>Max Sets</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={stsParams.maxSets}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...stsParams,
                        maxSets: parseInt(e.target.value),
                      };
                      form.setValue("exercises", exercises);
                    }}
                  />
                </FormControl>
              </FormItem>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Min Reps</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={stsParams.minReps}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...stsParams,
                        minReps: parseInt(e.target.value),
                      };
                      form.setValue("exercises", exercises);
                    }}
                  />
                </FormControl>
              </FormItem>
              <FormItem>
                <FormLabel>Max Reps</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={stsParams.maxReps}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...stsParams,
                        maxReps: parseInt(e.target.value),
                      };
                      form.setValue("exercises", exercises);
                    }}
                  />
                </FormControl>
              </FormItem>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Rest Between Sets (s)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={stsParams.restBetweenSets}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...stsParams,
                        restBetweenSets: parseInt(e.target.value),
                      };
                      form.setValue("exercises", exercises);
                    }}
                  />
                </FormControl>
              </FormItem>
              <FormItem>
                <FormLabel>Rest Between Exercises (s)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={stsParams.restBetweenExercises}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...stsParams,
                        restBetweenExercises: parseInt(e.target.value),
                      };
                      form.setValue("exercises", exercises);
                    }}
                  />
                </FormControl>
              </FormItem>
            </div>
          </div>
        );
      }

      case "DoubleProgression": {
        const doubleProgressionParams = parameters as DoubleProgressionParameters;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Sets</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={doubleProgressionParams.sets}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...doubleProgressionParams,
                        sets: parseInt(e.target.value),
                      };
                      form.setValue("exercises", exercises);
                    }}
                  />
                </FormControl>
              </FormItem>
              <FormItem>
                <FormLabel>Reps</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={doubleProgressionParams.reps}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...doubleProgressionParams,
                        reps: parseInt(e.target.value),
                      };
                      form.setValue("exercises", exercises);
                    }}
                  />
                </FormControl>
              </FormItem>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Rest Between Sets (s)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={doubleProgressionParams.restBetweenSets}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...doubleProgressionParams,
                        restBetweenSets: parseInt(e.target.value),
                      };
                      form.setValue("exercises", exercises);
                    }}
                  />
                </FormControl>
              </FormItem>
              <FormItem>
                <FormLabel>Rest Between Exercises (s)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={doubleProgressionParams.restBetweenExercises}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...doubleProgressionParams,
                        restBetweenExercises: parseInt(e.target.value),
                      };
                      form.setValue("exercises", exercises);
                    }}
                  />
                </FormControl>
              </FormItem>
            </div>
          </div>
        );
      }

      case "RPTTopSet": {
        const rptTopSetParams = parameters as RPTTopSetParameters;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Sets</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={rptTopSetParams.sets}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...rptTopSetParams,
                        sets: parseInt(e.target.value),
                      };
                      form.setValue("exercises", exercises);
                    }}
                  />
                </FormControl>
              </FormItem>
              <FormItem>
                <FormLabel>Reps</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={rptTopSetParams.reps}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...rptTopSetParams,
                        reps: parseInt(e.target.value),
                      };
                      form.setValue("exercises", exercises);
                    }}
                  />
                </FormControl>
              </FormItem>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Rest Between Sets (s)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={rptTopSetParams.restBetweenSets}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...rptTopSetParams,
                        restBetweenSets: parseInt(e.target.value),
                      };
                      form.setValue("exercises", exercises);
                    }}
                  />
                </FormControl>
              </FormItem>
              <FormItem>
                <FormLabel>Rest Between Exercises (s)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={rptTopSetParams.restBetweenExercises}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...rptTopSetParams,
                        restBetweenExercises: parseInt(e.target.value),
                      };
                      form.setValue("exercises", exercises);
                    }}
                  />
                </FormControl>
              </FormItem>
            </div>
          </div>
        );
      }

      case "RPTIndividual": {
        const rptIndividualParams = parameters as RPTIndividualParameters;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Sets</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={rptIndividualParams.sets}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...rptIndividualParams,
                        sets: parseInt(e.target.value),
                      };
                      form.setValue("exercises", exercises);
                    }}
                  />
                </FormControl>
              </FormItem>
              <FormItem>
                <FormLabel>Reps</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={rptIndividualParams.reps}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...rptIndividualParams,
                        reps: parseInt(e.target.value),
                      };
                      form.setValue("exercises", exercises);
                    }}
                  />
                </FormControl>
              </FormItem>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Rest Between Sets (s)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={rptIndividualParams.restBetweenSets}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...rptIndividualParams,
                        restBetweenSets: parseInt(e.target.value),
                      };
                      form.setValue("exercises", exercises);
                    }}
                  />
                </FormControl>
              </FormItem>
              <FormItem>
                <FormLabel>Rest Between Exercises (s)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={rptIndividualParams.restBetweenExercises}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...rptIndividualParams,
                        restBetweenExercises: parseInt(e.target.value),
                      };
                      form.setValue("exercises", exercises);
                    }}
                  />
                </FormControl>
              </FormItem>
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

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="exercises">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                {form.getValues("exercises").map((exercise, index) => (
                  <Draggable key={index} draggableId={`exercise-${index}`} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className="border p-4 rounded-lg space-y-4"
                      >
                        <div className="grid grid-cols-2 gap-4">
                          <FormItem>
                            <FormLabel>Exercise</FormLabel>
                            <Select
                              value={exercise.exerciseId.toString()}
                              onValueChange={(value) => handleExerciseSelect(index, parseInt(value))}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select an exercise" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {exercises.map((e) => (
                                  <SelectItem key={e.id} value={e.id.toString()}>
                                    {e.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                          <FormItem>
                            <FormLabel>Progression Scheme</FormLabel>
                            <Select
                              value={exercise.parameters.scheme}
                              onValueChange={(value: ProgressionScheme) => {
                                const exercises = form.getValues("exercises");
                                exercises[index].parameters = defaultProgressionParameters[value];
                                form.setValue("exercises", exercises);
                              }}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {progressionSchemes.map((scheme) => (
                                  <SelectItem key={scheme} value={scheme}>
                                    {scheme}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        </div>
                        {renderSchemeParameters(index, exercise.parameters.scheme)}
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => {
                            const exercises = form.getValues("exercises");
                            exercises.splice(index, 1);
                            form.setValue("exercises", exercises);
                          }}
                        >
                          Remove Exercise
                        </Button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <Button
          type="button"
          onClick={() => {
            const exercises = form.getValues("exercises");
            exercises.push({
              exerciseId: 0,
              parameters: defaultProgressionParameters["STS"],
            });
            form.setValue("exercises", exercises);
          }}
        >
          Add Exercise
        </Button>

        <Button type="submit" className="w-full">
          Save Workout
        </Button>
      </form>
    </Form>
  );
}