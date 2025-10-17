-- Create email accounts table
CREATE TABLE public.email_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  imap_host TEXT NOT NULL,
  imap_port INTEGER NOT NULL DEFAULT 993,
  imap_user TEXT NOT NULL,
  imap_password TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);

-- Create emails table
CREATE TABLE public.emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  folder TEXT NOT NULL DEFAULT 'INBOX',
  received_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ai_category TEXT CHECK (ai_category IN ('interested', 'meeting_booked', 'not_interested', 'spam', 'out_of_office')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id, message_id)
);

-- Create suggested replies table
CREATE TABLE public.suggested_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  suggested_text TEXT NOT NULL,
  confidence_score DECIMAL(3,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product context table for RAG
CREATE TABLE public.product_context (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggested_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_context ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_accounts
CREATE POLICY "Users can view their own email accounts"
  ON public.email_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email accounts"
  ON public.email_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email accounts"
  ON public.email_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email accounts"
  ON public.email_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for emails
CREATE POLICY "Users can view emails from their accounts"
  ON public.emails FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.email_accounts
      WHERE email_accounts.id = emails.account_id
      AND email_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert emails to their accounts"
  ON public.emails FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.email_accounts
      WHERE email_accounts.id = emails.account_id
      AND email_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update emails in their accounts"
  ON public.emails FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.email_accounts
      WHERE email_accounts.id = emails.account_id
      AND email_accounts.user_id = auth.uid()
    )
  );

-- RLS Policies for suggested_replies
CREATE POLICY "Users can view suggested replies for their emails"
  ON public.suggested_replies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.emails
      JOIN public.email_accounts ON emails.account_id = email_accounts.id
      WHERE emails.id = suggested_replies.email_id
      AND email_accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert suggested replies for their emails"
  ON public.suggested_replies FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.emails
      JOIN public.email_accounts ON emails.account_id = email_accounts.id
      WHERE emails.id = suggested_replies.email_id
      AND email_accounts.user_id = auth.uid()
    )
  );

-- RLS Policies for product_context
CREATE POLICY "Users can view their own product context"
  ON public.product_context FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own product context"
  ON public.product_context FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own product context"
  ON public.product_context FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own product context"
  ON public.product_context FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_emails_account_id ON public.emails(account_id);
CREATE INDEX idx_emails_received_at ON public.emails(received_at DESC);
CREATE INDEX idx_emails_category ON public.emails(ai_category);
CREATE INDEX idx_emails_folder ON public.emails(folder);
CREATE INDEX idx_suggested_replies_email_id ON public.suggested_replies(email_id);

-- Create update trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_email_accounts_updated_at
  BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_emails_updated_at
  BEFORE UPDATE ON public.emails
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_context_updated_at
  BEFORE UPDATE ON public.product_context
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();