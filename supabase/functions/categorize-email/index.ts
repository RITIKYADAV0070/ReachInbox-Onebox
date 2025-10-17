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
    const { emailId } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch the email
    const { data: email, error: emailError } = await supabase
      .from("emails")
      .select("*")
      .eq("id", emailId)
      .single();

    if (emailError) throw emailError;

    // Call Lovable AI for categorization
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const categorizationPrompt = `Analyze this email and categorize it into ONE of these categories:
- interested: The sender is interested in your product/service
- meeting_booked: The sender has booked or confirmed a meeting
- not_interested: The sender is not interested
- spam: This is spam or unwanted email
- out_of_office: This is an out-of-office auto-reply

Email Subject: ${email.subject}
Email Body: ${email.body_text || email.body_html}

Respond with ONLY the category name (lowercase, underscore-separated).`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are an email classification expert. Respond only with the category name.",
          },
          {
            role: "user",
            content: categorizationPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${await response.text()}`);
    }

    const data = await response.json();
    const category = data.choices[0].message.content.trim().toLowerCase();

    console.log(`Categorized email ${emailId} as: ${category}`);

    // Update email with category
    const { error: updateError } = await supabase
      .from("emails")
      .update({ ai_category: category })
      .eq("id", emailId);

    if (updateError) throw updateError;

    // If categorized as "interested", trigger Slack notification and webhook
    if (category === "interested") {
      console.log("Triggering notifications for interested email");
      
      // Trigger Slack notification
      const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL");
      if (SLACK_WEBHOOK_URL) {
        await fetch(SLACK_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `🎉 New Interested Lead!\n\nFrom: ${email.from_address}\nSubject: ${email.subject}\n\nEmail: ${email.body_text?.substring(0, 200)}...`,
          }),
        });
      }

      // Trigger webhook (webhook.site)
      const WEBHOOK_URL = "https://webhook.site/your-unique-id"; // User can configure this
      try {
        await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "interested_email",
            email: {
              id: email.id,
              from: email.from_address,
              subject: email.subject,
              received_at: email.received_at,
            },
          }),
        });
      } catch (webhookError) {
        console.error("Webhook error:", webhookError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, category }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Categorization error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});