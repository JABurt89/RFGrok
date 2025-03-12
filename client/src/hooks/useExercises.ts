import { useQuery } from "@tanstack/react-query";
import { Exercise } from "../types";

export const useExercises = () => {
  const { data: exercises = [], isLoading, error } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
  });

  return { exercises, isLoading, error };
};
