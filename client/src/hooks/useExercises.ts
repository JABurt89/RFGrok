import { Exercise } from "../types";
import { useApi } from "./useApi";

export const useExercises = () => {
  const { data: exercises = [], isLoading, error } = useApi<Exercise[]>({
    url: "/api/exercises",
    queryKey: ["/api/exercises"],
  });

  return { exercises, isLoading, error };
};