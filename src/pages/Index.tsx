import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Inbox } from "@/components/email/Inbox";
import { EmailDetail } from "@/components/email/EmailDetail";
import { AccountSetup } from "@/components/email/AccountSetup";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate("/auth");
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-secondary">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center space-x-4">
            <h1 className="bg-gradient-to-r from-primary to-accent bg-clip-text text-2xl font-bold text-transparent">
              ReachInbox Onebox
            </h1>
          </div>
          <Button onClick={handleSignOut} variant="outline" size="sm">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto flex flex-1 gap-6 p-6">
        {/* Email List */}
        <div className="w-96 flex-shrink-0">
          <Inbox onSelectEmail={setSelectedEmailId} selectedEmailId={selectedEmailId} />
        </div>

        {/* Email Detail */}
        <div className="flex-1">
          {selectedEmailId ? (
            <EmailDetail emailId={selectedEmailId} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-border bg-card/30">
              <p className="text-muted-foreground">Select an email to view details</p>
            </div>
          )}
        </div>

        {/* Account Setup Sidebar */}
        <div className="w-80 flex-shrink-0">
          <AccountSetup />
        </div>
      </div>
    </div>
  );
};

export default Index;