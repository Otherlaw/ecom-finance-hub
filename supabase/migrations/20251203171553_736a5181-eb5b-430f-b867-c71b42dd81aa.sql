-- Drop existing RESTRICTIVE policies on credit_card_invoices
DROP POLICY IF EXISTS "Allow authenticated users to insert invoices" ON public.credit_card_invoices;
DROP POLICY IF EXISTS "Allow authenticated users to read invoices" ON public.credit_card_invoices;
DROP POLICY IF EXISTS "Allow authenticated users to update invoices" ON public.credit_card_invoices;
DROP POLICY IF EXISTS "Allow authenticated users to delete invoices" ON public.credit_card_invoices;

-- Recreate as PERMISSIVE policies (default)
CREATE POLICY "Allow all users to insert invoices" 
ON public.credit_card_invoices 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow all users to read invoices" 
ON public.credit_card_invoices 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all users to update invoices" 
ON public.credit_card_invoices 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow all users to delete invoices" 
ON public.credit_card_invoices 
FOR DELETE 
USING (true);

-- Also fix credit_card_transactions policies
DROP POLICY IF EXISTS "Allow authenticated users to insert transactions" ON public.credit_card_transactions;
DROP POLICY IF EXISTS "Allow authenticated users to read transactions" ON public.credit_card_transactions;
DROP POLICY IF EXISTS "Allow authenticated users to update transactions" ON public.credit_card_transactions;
DROP POLICY IF EXISTS "Allow authenticated users to delete transactions" ON public.credit_card_transactions;

CREATE POLICY "Allow all users to insert transactions" 
ON public.credit_card_transactions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow all users to read transactions" 
ON public.credit_card_transactions 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all users to update transactions" 
ON public.credit_card_transactions 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow all users to delete transactions" 
ON public.credit_card_transactions 
FOR DELETE 
USING (true);