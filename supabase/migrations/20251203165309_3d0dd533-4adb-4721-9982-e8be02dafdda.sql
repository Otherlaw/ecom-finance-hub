-- Drop existing restrictive RLS policies for credit_cards
DROP POLICY IF EXISTS "Allow authenticated users to delete credit_cards" ON public.credit_cards;
DROP POLICY IF EXISTS "Allow authenticated users to insert credit_cards" ON public.credit_cards;
DROP POLICY IF EXISTS "Allow authenticated users to read credit_cards" ON public.credit_cards;
DROP POLICY IF EXISTS "Allow authenticated users to update credit_cards" ON public.credit_cards;

-- Create new permissive policies for credit_cards (allowing public access)
CREATE POLICY "Allow public read credit_cards" ON public.credit_cards FOR SELECT USING (true);
CREATE POLICY "Allow public insert credit_cards" ON public.credit_cards FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update credit_cards" ON public.credit_cards FOR UPDATE USING (true);
CREATE POLICY "Allow public delete credit_cards" ON public.credit_cards FOR DELETE USING (true);