// src/components/workout-day-form.tsx
import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { useForm, FormProvider, useFieldArray } from "react-hook-form";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface WorkoutDayFormProps {
  submitWorkoutDay: (data: WorkoutDayFormData) => void;
}

interface WorkoutDayFormData {
  name: string;
  exercises: { name: string; scheme: string; restBetweenSets: number; restBetweenExercises: number }[];
}

export function WorkoutDayForm({ submitWorkoutDay }: WorkoutDayFormProps) {
  const methods = useForm<WorkoutDayFormData>({
    defaultValues: {
      name: "",
      exercises: [{ name: "", scheme: "STS", restBetweenSets: 120, restBetweenExercises: 180 }],
    },
  });
  const { register, control, handleSubmit } = methods;
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "exercises",
  });

  const onSubmit = (data: WorkoutDayFormData) => {
    console.log("Form submitted with data:", data); // Debug log
    submitWorkoutDay(data); // Call the prop function to handle submission
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    move(result.source.index, result.destination.index);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium">
            Workout Day Name
          </label>
          <Input id="name" {...register("name", { required: true })} placeholder="e.g., Leg Day" />
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="exercises">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                {fields.map((field, index) => (
                  <Draggable key={field.id} draggableId={field.id} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className="flex space-x-2 items-center mb-2"
                      >
                        <Input
                          {...register(`exercises.${index}.name`, { required: true })}
                          placeholder="Exercise Name"
                        />
                        <Input
                          {...register(`exercises.${index}.scheme`, { required: true })}
                          placeholder="Scheme (e.g., STS)"
                        />
                        <Input
                          type="number"
                          {...register(`exercises.${index}.restBetweenSets`, { required: true, valueAsNumber: true })}
                          placeholder="Rest Between Sets (s)"
                        />
                        <Input
                          type="number"
                          {...register(`exercises.${index}.restBetweenExercises`, { required: true, valueAsNumber: true })}
                          placeholder="Rest Between Exercises (s)"
                        />
                        <Button type="button" onClick={() => remove(index)}>
                          Remove
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

        <Button type="button" onClick={() => append({ name: "", scheme: "STS", restBetweenSets: 120, restBetweenExercises: 180 })}>
          Add Exercise
        </Button>
        <Button type="submit">Create Workout</Button>
      </form>
    </FormProvider>
  );
}