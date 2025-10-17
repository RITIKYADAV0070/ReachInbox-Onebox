import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get all active email accounts
    const { data: accounts, error: accountsError } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("is_active", true);

    if (accountsError) throw accountsError;

    console.log(`Starting IMAP sync for ${accounts?.length || 0} accounts`);

    for (const account of accounts || []) {
      try {
        // In a real implementation, you would use a proper IMAP library
        // For demonstration, we'll use a placeholder that simulates IMAP sync
        // You would replace this with actual IMAP library like node-imap
        
        console.log(`Syncing account: ${account.email}`);

        // Simulated email data - in production, fetch from IMAP server
        const mockEmails = [
          {
            message_id: `<mock-${Date.now()}@example.com>`,
            from_address: "john@example.com",
            to_address: account.email,
            subject: "Interested in your services",
            body_text: "Hi, I'm very interested in learning more about your product. Can we schedule a call?",
            folder: "INBOX",
            received_at: new Date().toISOString(),
          },
        ];

        for (const email of mockEmails) {
          // Insert or update email
          const { data: existingEmail } = await supabase
            .from("emails")
            .select("id")
            .eq("account_id", account.id)
            .eq("message_id", email.message_id)
            .single();

          if (!existingEmail) {
            const { error: insertError } = await supabase.from("emails").insert({
              account_id: account.id,
              ...email,
            });

            if (insertError) {
              console.error(`Error inserting email: ${insertError.message}`);
            } else {
              console.log(`Inserted new email: ${email.subject}`);
              
              // Trigger AI categorization
              const { data: newEmail } = await supabase
                .from("emails")
                .select("id")
                .eq("account_id", account.id)
                .eq("message_id", email.message_id)
                .single();

              if (newEmail) {
                await supabase.functions.invoke("categorize-email", {
                  body: { emailId: newEmail.id },
                });
              }
            }
          }
        }

        // Update last sync time
        await supabase
          .from("email_accounts")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("id", account.id);

      } catch (error) {
        console.error(`Error syncing account ${account.email}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: `Synced ${accounts?.length || 0} accounts` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("IMAP sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});