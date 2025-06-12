import AppLayout from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";

export default function TestProfilePage() {
  const { user } = useAuth();
  
  console.log("TestProfilePage rendering");
  
  return (
    <AppLayout>
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Test Profile Page</h1>
        <div className="bg-green-100 p-4 rounded">
          <p>This is a test profile page that should work!</p>
          <p>User: {user?.name || "No user"}</p>
          <p>Role: {user?.role || "No role"}</p>
        </div>
      </div>
    </AppLayout>
  );
}