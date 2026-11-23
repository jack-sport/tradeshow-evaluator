-- JAXPORT's mission is two-part: win ship calls (ocean carrier marketing) and fill the ships
-- (BCO and routing decision-maker marketing). Ocean carrier executives count as priority
-- targets and customers alongside BCOs, not as a second tier.
-- Cost criteria also count what a package includes (registrations, attendee lists, meeting space).
-- Wording only: weights are unchanged, and saved scores are unaffected until someone re-rates.

update public.criteria set description =
  'Number and concentration of priority targets realistically accessible: BCOs and routing decision-makers (to fill ships) and ocean carrier executives who decide services and port calls (to win ship calls).'
where label = 'High-value target accounts';

update public.criteria set description =
  'Presence of BCOs and ocean carriers first (the two halves of JAXPORT''s mission), then forwarders, customs brokers and 3PLs.'
where label = 'Audience composition and quality';

update public.criteria set description =
  'Access to important current customers and active accounts, including BCOs and the ocean carriers already calling JAXPORT.'
where label = 'Existing customers and accounts';

-- Moves from "Relationship management" to "Business development", right after the other business development criteria.
update public.criteria set
  label = 'Ocean carrier access',
  category = 'Business development',
  description = 'Access to ocean carrier network, service and port-call decision-makers, plus partners that matter to JAXPORT strategy.',
  sort_order = 55
where label = 'Carriers and strategic partners';

update public.criteria set description =
  'Fully loaded cost of attending (registration, travel, staff time) relative to the accessible opportunity, counting what the package includes, such as attendee lists or meeting space.'
where label = 'Cost and staff efficiency';

update public.criteria set description =
  'Incremental cost of exhibiting over attending, relative to the added traffic, meetings and visibility, counting what the booth or sponsorship includes, such as registrations or attendee lists.'
where label = 'Exhibit cost efficiency';
