import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2, Mail, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface EmailAccount {
  id: string;
  email: string;
  is_active: boolean;
  last_sync_at: string | null;
}

export const AccountSetup = () => {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    imap_host: "",
    imap_port: "993",
    imap_user: "",
    imap_password: "",
  });
  const { toast } = useToast();

  const fetchAccounts = async () => {
    const { data, error } = await supabase
      .from("email_accounts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error fetching accounts",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setAccounts(data || []);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("email_accounts").insert({
        user_id: user.id,
        ...formData,
        imap_port: parseInt(formData.imap_port),
      });

      if (error) throw error;

      toast({
        title: "Account added!",
        description: "Email account has been configured",
      });

      setFormData({
        email: "",
        imap_host: "",
        imap_port: "993",
        imap_user: "",
        imap_password: "",
      });
      setShowForm(false);
      fetchAccounts();

      // Trigger IMAP sync
      await supabase.functions.invoke("sync-imap");
    } catch (error: any) {
      toast({
        title: "Error adding account",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      const { error } = await supabase.from("email_accounts").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Account deleted",
        description: "Email account has been removed",
      });
      fetchAccounts();
    } catch (error: any) {
      toast({
        title: "Error deleting account",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const triggerSync = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("sync-imap");

      if (error) throw error;

      toast({
        title: "Sync started",
        description: "Emails are being synchronized",
      });
    } catch (error: any) {
      toast({
        title: "Error syncing",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex h-full flex-col border-border/50 bg-card/80 backdrop-blur-sm">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Email Accounts</h2>
          <Button onClick={triggerSync} size="sm" variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {showForm && (
          <Card className="mb-4 border-primary/20 bg-primary/5 p-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="email" className="text-xs">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="your@email.com"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="imap_host" className="text-xs">IMAP Host</Label>
                <Input
                  id="imap_host"
                  value={formData.imap_host}
                  onChange={(e) => setFormData({ ...formData, imap_host: e.target.value })}
                  required
                  placeholder="imap.gmail.com"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="imap_port" className="text-xs">IMAP Port</Label>
                <Input
                  id="imap_port"
                  type="number"
                  value={formData.imap_port}
                  onChange={(e) => setFormData({ ...formData, imap_port: e.target.value })}
                  required
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="imap_user" className="text-xs">IMAP Username</Label>
                <Input
                  id="imap_user"
                  value={formData.imap_user}
                  onChange={(e) => setFormData({ ...formData, imap_user: e.target.value })}
                  required
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="imap_password" className="text-xs">IMAP Password</Label>
                <Input
                  id="imap_password"
                  type="password"
                  value={formData.imap_password}
                  onChange={(e) => setFormData({ ...formData, imap_password: e.target.value })}
                  required
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" className="flex-1" disabled={loading}>
                  {loading ? "Adding..." : "Add"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        <div className="space-y-2">
          {accounts.map((account) => (
            <Card key={account.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Mail className="h-4 w-4 text-primary flex-shrink-0" />
                    <p className="truncate text-sm font-medium">{account.email}</p>
                  </div>
                  {account.last_sync_at && (
                    <p className="text-xs text-muted-foreground">
                      Last sync: {new Date(account.last_sync_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {account.is_active && <Badge variant="outline" className="text-xs">Active</Badge>}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteAccount(account.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};