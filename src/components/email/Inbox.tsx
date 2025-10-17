import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Mail, MailOpen } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

interface Email {
  id: string;
  subject: string;
  from_address: string;
  received_at: string;
  ai_category: string | null;
  is_read: boolean;
  folder: string;
}

interface InboxProps {
  onSelectEmail: (emailId: string) => void;
  selectedEmailId: string | null;
}

const categoryColors: Record<string, string> = {
  interested: "bg-success text-success-foreground",
  meeting_booked: "bg-info text-info-foreground",
  not_interested: "bg-destructive text-destructive-foreground",
  spam: "bg-warning text-warning-foreground",
  out_of_office: "bg-muted text-muted-foreground",
};

export const Inbox = ({ onSelectEmail, selectedEmailId }: InboxProps) => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchEmails = async () => {
    try {
      let query = supabase.from("emails").select("*").order("received_at", { ascending: false });

      if (folderFilter !== "all") {
        query = query.eq("folder", folderFilter);
      }

      if (categoryFilter !== "all") {
        query = query.eq("ai_category", categoryFilter);
      }

      if (searchQuery) {
        query = query.or(
          `subject.ilike.%${searchQuery}%,from_address.ilike.%${searchQuery}%,body_text.ilike.%${searchQuery}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      setEmails(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching emails",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [folderFilter, categoryFilter, searchQuery]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("emails-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "emails" }, () => {
        fetchEmails();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [folderFilter, categoryFilter, searchQuery]);

  return (
    <Card className="flex h-full flex-col border-border/50 bg-card/80 backdrop-blur-sm">
      <div className="border-b border-border p-4 space-y-3">
        <h2 className="text-lg font-semibold">Inbox</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={folderFilter} onValueChange={setFolderFilter}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Folders</SelectItem>
              <SelectItem value="INBOX">Inbox</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="interested">Interested</SelectItem>
              <SelectItem value="meeting_booked">Meeting Booked</SelectItem>
              <SelectItem value="not_interested">Not Interested</SelectItem>
              <SelectItem value="spam">Spam</SelectItem>
              <SelectItem value="out_of_office">Out of Office</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-pulse">Loading emails...</div>
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Mail className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No emails found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {emails.map((email) => (
              <button
                key={email.id}
                onClick={() => onSelectEmail(email.id)}
                className={`w-full p-4 text-left transition-colors hover:bg-accent/50 ${
                  selectedEmailId === email.id ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {email.is_read ? (
                        <MailOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <Mail className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                      <p className="truncate font-medium text-sm">{email.from_address}</p>
                    </div>
                    <p className="truncate text-sm font-semibold mb-1">
                      {email.subject || "(No subject)"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(email.received_at), "MMM d, h:mm a")}
                    </p>
                  </div>
                  {email.ai_category && (
                    <Badge className={`${categoryColors[email.ai_category]} text-xs flex-shrink-0`}>
                      {email.ai_category.replace("_", " ")}
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};