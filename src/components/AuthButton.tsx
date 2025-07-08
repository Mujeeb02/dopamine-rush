
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, User } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const AuthButton = () => {
  const { user, signOut, isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-300 hidden sm:block">
          {user?.email}
        </span>
        <Button 
          onClick={signOut}
          variant="ghost" 
          size="sm"
          className="text-white hover:bg-white/10"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <Link to="/auth">
      <Button variant="ghost" className="text-white hover:bg-white/10">
        <LogIn className="w-4 h-4 mr-2" />
        Sign In
      </Button>
    </Link>
  );
};

export default AuthButton;
