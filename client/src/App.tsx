import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";

console.log('App component is rendering'); // Debug log

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <h1 className="text-4xl font-bold">Welcome to Workout Tracker</h1>
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;