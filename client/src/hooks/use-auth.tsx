import { createContext, ReactNode, useContext } from "react";
import { User as SelectUser, InsertUser } from "@shared/schema";
import { useApi } from "./useApi";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "../lib/queryClient";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: ReturnType<typeof useApi<SelectUser, Error>>;
  logoutMutation: ReturnType<typeof useApi<void, Error>>;
  registerMutation: ReturnType<typeof useApi<SelectUser, Error>>;
};

type LoginData = Pick<InsertUser, "email" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  // User query
  const {
    data: user,
    error,
    isLoading,
  } = useApi<SelectUser | undefined, Error>({
    url: "/api/user",
    queryKey: ["/api/user"],
  });

  // Login mutation
  const loginMutation = useApi<SelectUser, Error>({
    url: "/api/login",
    method: "POST",
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Register mutation
  const registerMutation = useApi<SelectUser, Error>({
    url: "/api/register",
    method: "POST",
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Logout mutation
  const logoutMutation = useApi<void, Error>({
    url: "/api/logout",
    method: "POST",
    parseResponse: false, // Don't try to parse empty response as JSON
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}