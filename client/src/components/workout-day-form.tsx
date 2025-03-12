import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { WorkoutDay, InsertWorkoutDay, insertWorkoutDaySchema, Exercise, ProgressionScheme, progressionSchemes } from "@shared/schema";
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
                  {form.watch("exercises").map((exercise, index) => (
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
                          className="bg-card p-4 rounded-lg"
                        >
                          <div className="space-y-2">
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

                            <div className="flex gap-2">
                              <Input
                                type="number"
                                placeholder="Rest between sets (s)"
                                value={exercise.restBetweenSets}
                                onChange={(e) => {
                                  const exercises = form.getValues("exercises");
                                  exercises[index].restBetweenSets = parseInt(e.target.value);
                                  form.setValue("exercises", exercises);
                                }}
                              />
                              <Input
                                type="number"
                                placeholder="Rest between exercises (s)"
                                value={exercise.restBetweenExercises}
                                onChange={(e) => {
                                  const exercises = form.getValues("exercises");
                                  exercises[index].restBetweenExercises = parseInt(e.target.value);
                                  form.setValue("exercises", exercises);
                                }}
                              />
                            </div>
                          </div>
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
                  restBetweenSets: 90,
                  restBetweenExercises: 180,
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
