import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { 
  WorkoutDay, 
  InsertWorkoutDay, 
  insertWorkoutDaySchema, 
  Exercise, 
  ProgressionScheme, 
  progressionSchemes,
  defaultProgressionParameters,
  WorkoutExercise
} from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

type WorkoutDayFormProps = {
  workoutDay?: WorkoutDay;
  onComplete: () => void;
};

export default function WorkoutDayForm({ workoutDay, onComplete }: WorkoutDayFormProps) {
  const { toast } = useToast();
  const { data: exercises = [] } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
  });

  const form = useForm<InsertWorkoutDay>({
    resolver: zodResolver(insertWorkoutDaySchema),
    defaultValues: {
      name: workoutDay?.name ?? "",
      exercises: workoutDay?.exercises ?? [],
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertWorkoutDay) => {
      const res = await apiRequest(
        workoutDay ? "PATCH" : "POST",
        workoutDay ? `/api/workout-days/${workoutDay.id}` : "/api/workout-days",
        data
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-days"] });
      toast({
        title: `Workout ${workoutDay ? "updated" : "created"}`,
        description: `Successfully ${workoutDay ? "updated" : "created"} workout`,
      });
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(form.getValues("exercises"));
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    form.setValue("exercises", items);
  };

  const renderSchemeParameters = (index: number, scheme: ProgressionScheme) => {
    const exercises = form.getValues("exercises");
    const exercise = exercises[index];
    const parameters = exercise?.parameters ?? defaultProgressionParameters[scheme];

    switch (scheme) {
      case "STS":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Min Sets</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={parameters.minSets}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...parameters,
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
                    value={parameters.maxSets}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...parameters,
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
                    value={parameters.minReps}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...parameters,
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
                    value={parameters.maxReps}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...parameters,
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
                    value={parameters.restBetweenSets}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...parameters,
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
                    value={parameters.restBetweenExercises}
                    onChange={(e) => {
                      const exercises = form.getValues("exercises");
                      exercises[index].parameters = {
                        ...parameters,
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

      // Add similar parameter inputs for other schemes
      // Double Progression, RPT Top-Set, and RPT Individual
      default:
        return null;
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Push Day" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <FormLabel>Exercises</FormLabel>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="exercises">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2"
                >
                  {form.watch("exercises").map((exercise: WorkoutExercise, index) => (
                    <Draggable
                      key={index}
                      draggableId={index.toString()}
                      index={index}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="bg-card p-4 rounded-lg space-y-4"
                        >
                          <Select
                            value={exercise.exerciseId.toString()}
                            onValueChange={(value) => {
                              const exercises = form.getValues("exercises");
                              exercises[index].exerciseId = parseInt(value);
                              form.setValue("exercises", exercises);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select exercise" />
                            </SelectTrigger>
                            <SelectContent>
                              {exercises.map((ex) => (
                                <SelectItem key={ex.id} value={ex.id.toString()}>
                                  {ex.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={exercise.scheme}
                            onValueChange={(value) => {
                              const exercises = form.getValues("exercises");
                              exercises[index].scheme = value as ProgressionScheme;
                              exercises[index].parameters = defaultProgressionParameters[value as ProgressionScheme];
                              form.setValue("exercises", exercises);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select scheme" />
                            </SelectTrigger>
                            <SelectContent>
                              {progressionSchemes.map((scheme) => (
                                <SelectItem key={scheme} value={scheme}>
                                  {scheme}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {renderSchemeParameters(index, exercise.scheme)}
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
            variant="outline"
            onClick={() =>
              form.setValue("exercises", [
                ...form.getValues("exercises"),
                {
                  exerciseId: exercises[0]?.id ?? 0,
                  scheme: "STS",
                  parameters: defaultProgressionParameters.STS,
                },
              ])
            }
          >
            Add Exercise
          </Button>
        </div>

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : workoutDay ? "Update Workout" : "Create Workout"}
        </Button>
      </form>
    </Form>
  );
}