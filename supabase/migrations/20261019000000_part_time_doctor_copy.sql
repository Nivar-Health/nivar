-- Website review, October 2026: Nivar doctors are part-time, and the Heart Check is reviewed by a
-- Nivar doctor rather than always by a cardiologist. Rewrites only those phrases, so any other admin
-- edits to the catalogue stay as they are.

update public.packages
   set tagline = replace(tagline, 'reviewed live by a cardiologist', 'reviewed live by a doctor')
 where tagline like '%reviewed live by a cardiologist%';

update public.services
   set description = replace(description, 'a full-time Nivar doctor', 'a Nivar doctor')
 where description like '%a full-time Nivar doctor%';

update public.packages
   set description = replace(description, 'a full-time Nivar doctor', 'a Nivar doctor')
 where description like '%a full-time Nivar doctor%';
