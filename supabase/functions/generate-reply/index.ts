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

    // Get user from authorization header
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) throw new Error("Unauthorized");

    // Fetch the email
    const { data: email, error: emailError } = await supabase
      .from("emails")
      .select("*, email_accounts!inner(user_id)")
      .eq("id", emailId)
      .single();

    if (emailError) throw emailError;

    // Verify user owns this email
    if (email.email_accounts.user_id !== user.id) {
      throw new Error("Unauthorized");
    }

    // Get product context for RAG
    const { data: productContext, error: contextError } = await supabase
      .from("product_context")
      .select("*")
      .eq("user_id", user.id)
      .limit(5);

    if (contextError) console.error("Context error:", contextError);

    // Build context from product information
    let contextText = "Product/Service Context:\n";
    if (productContext && productContext.length > 0) {
      contextText += productContext.map(c => `${c.context_type}: ${c.content}`).join("\n");
    } else {
      // Default context if none provided
      contextText += `- I am a job seeker applying for positions
- If a lead is interested, share the meeting booking link: https://cal.com/example
- Be professional and enthusiastic`;
    }

    // Call Lovable AI for reply suggestion using RAG
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const replyPrompt = `Based on the following context and the received email, generate a professional reply.

${contextText}

Received Email:
From: ${email.from_address}
Subject: ${email.subject}
Body: ${email.body_text || email.body_html}

Generate a professional, personalized reply that:
1. Addresses their interests/questions
2. References relevant product/service information from the context
3. Includes any appropriate links (like booking links)
4. Is warm and professional

Reply:`;

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
            content: "You are a professional email assistant. Generate helpful, personalized email replies based on the provided context.",
          },
          {
            role: "user",
            content: replyPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${await response.text()}`);
    }

    const data = await response.json();
    const suggestedReply = data.choices[0].message.content.trim();

    console.log(`Generated reply for email ${emailId}`);

    // Store the suggested reply
    const { error: insertError } = await supabase.from("suggested_replies").insert({
      email_id: emailId,
      suggested_text: suggestedReply,
      confidence_score: 0.85, // You could calculate this based on context quality
    });

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, reply: suggestedReply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Reply generation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});