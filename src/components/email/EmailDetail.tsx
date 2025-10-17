import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Sparkles, Copy, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface EmailDetailProps {
  emailId: string;
}

interface Email {
  id: string;
  subject: string;
  from_address: string;
  to_address: string;
  received_at: string;
  body_text: string;
  body_html: string;
  ai_category: string | null;
  folder: string;
}

interface SuggestedReply {
  id: string;
  suggested_text: string;
  confidence_score: number;
}

const categoryColors: Record<string, string> = {
  interested: "bg-success text-success-foreground",
  meeting_booked: "bg-info text-info-foreground",
  not_interested: "bg-destructive text-destructive-foreground",
  spam: "bg-warning text-warning-foreground",
  out_of_office: "bg-muted text-muted-foreground",
};

export const EmailDetail = ({ emailId }: EmailDetailProps) => {
  const [email, setEmail] = useState<Email | null>(null);
  const [suggestedReplies, setSuggestedReplies] = useState<SuggestedReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingReply, setGeneratingReply] = useState(false);
  const { toast } = useToast();

  const fetchEmailAndReplies = async () => {
    try {
      const { data: emailData, error: emailError } = await supabase
        .from("emails")
        .select("*")
        .eq("id", emailId)
        .single();

      if (emailError) throw emailError;
      setEmail(emailData);

      // Mark as read
      await supabase.from("emails").update({ is_read: true }).eq("id", emailId);

      const { data: repliesData, error: repliesError } = await supabase
        .from("suggested_replies")
        .select("*")
        .eq("email_id", emailId)
        .order("confidence_score", { ascending: false });

      if (repliesError) throw repliesError;
      setSuggestedReplies(repliesData || []);
    } catch (error: any) {
      toast({
        title: "Error fetching email",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailAndReplies();
  }, [emailId]);

  const generateReply = async () => {
    setGeneratingReply(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-reply", {
        body: { emailId },
      });

      if (error) throw error;

      toast({
        title: "Reply generated!",
        description: "AI has suggested a reply",
      });

      fetchEmailAndReplies();
    } catch (error: any) {
      toast({
        title: "Error generating reply",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingReply(false);
    }
  };

  const copyReply = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Reply copied to clipboard",
    });
  };

  if (loading) {
    return (
      <Card className="flex h-full items-center justify-center border-border/50 bg-card/80">
        <div className="animate-pulse">Loading email...</div>
      </Card>
    );
  }

  if (!email) {
    return (
      <Card className="flex h-full items-center justify-center border-border/50 bg-card/80">
        <p className="text-muted-foreground">Email not found</p>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col border-border/50 bg-card/80 backdrop-blur-sm">
      <div className="border-b border-border p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">{email.subject || "(No subject)"}</h2>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>From: {email.from_address}</span>
              <span>To: {email.to_address}</span>
              <span>{format(new Date(email.received_at), "MMM d, yyyy h:mm a")}</span>
            </div>
          </div>
          {email.ai_category && (
            <Badge className={categoryColors[email.ai_category]}>
              {email.ai_category.replace("_", " ")}
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="prose prose-sm max-w-none">
          {email.body_html ? (
            <div dangerouslySetInnerHTML={{ __html: email.body_html }} />
          ) : (
            <pre className="whitespace-pre-wrap font-sans">{email.body_text}</pre>
          )}
        </div>

        {suggestedReplies.length > 0 && (
          <>
            <Separator className="my-6" />
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">AI Suggested Replies</h3>
              </div>
              {suggestedReplies.map((reply) => (
                <Card key={reply.id} className="p-4 border-primary/20 bg-primary/5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm text-muted-foreground">
                      Confidence: {(reply.confidence_score * 100).toFixed(0)}%
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyReply(reply.suggested_text)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="whitespace-pre-wrap">{reply.suggested_text}</p>
                </Card>
              ))}
            </div>
          </>
        )}
      </ScrollArea>

      <div className="border-t border-border p-4">
        <Button
          onClick={generateReply}
          disabled={generatingReply}
          className="w-full"
        >
          {generatingReply ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Generating Reply...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate AI Reply
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};