-- Fictional South Florida development data.
-- These are not real businesses. Safe to re-run: inserts use fixed UUIDs.

insert into public.agents (id, slug, name, description, status, enabled) values
  ('00000000-0000-4000-8000-000000000001', 'scout', 'Scout', 'Discover strong local businesses that have poor websites.', 'disabled', false),
  ('00000000-0000-4000-8000-000000000002', 'auditor', 'Auditor', 'Analyze websites, SEO, mobile usability, and conversion quality.', 'disabled', false),
  ('00000000-0000-4000-8000-000000000003', 'builder', 'Builder', 'Generate improved websites from approved qualified leads.', 'disabled', false),
  ('00000000-0000-4000-8000-000000000004', 'sales', 'Sales', 'Prepare personalized outreach for approved prospects.', 'disabled', false),
  ('00000000-0000-4000-8000-000000000005', 'manager', 'Manager', 'Handle requested updates for paying managed customers.', 'disabled', false)
on conflict (id) do nothing;

insert into public.leads (
  id, business_name, industry, address, city, state, phone, email, website_url,
  google_rating, review_count, status, lead_score, source, notes, created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001', 'Harborline Plumbing', 'Plumbing', '1842 SE 17th Street', 'Fort Lauderdale', 'FL', '(954) 555-0142', 'owner@harborlineplumbing.example.test', 'https://www.harborlineplumbing.example.test', 4.8, 312, 'qualified', 86, 'seed', 'Fictional business for development only.', '2026-07-12 14:20:00+00', '2026-07-12 14:20:00+00'),
  ('10000000-0000-4000-8000-000000000002', 'Palmetto Air & Heat', 'HVAC', '4121 Lyons Road', 'Coconut Creek', 'FL', '(954) 555-0198', 'hello@palmettoair.example.test', 'https://www.palmettoair.example.test', 4.7, 198, 'customer', 91, 'seed', 'Fictional business for development only.', '2026-07-08 11:05:00+00', '2026-08-12 16:30:00+00'),
  ('10000000-0000-4000-8000-000000000003', 'Ridgeway Roofing', 'Roofing', '950 N Federal Highway', 'Pompano Beach', 'FL', '(954) 555-0164', 'office@ridgewayroofing.example.test', 'https://www.ridgewayroofing.example.test', 4.9, 421, 'website_built', 88, 'seed', 'Fictional business for development only.', '2026-07-18 16:40:00+00', '2026-08-28 09:05:00+00'),
  ('10000000-0000-4000-8000-000000000004', 'Cypress Grove Landscaping', 'Landscaping', '225 Yamato Road', 'Boca Raton', 'FL', '(561) 555-0133', 'info@cypressgrove.example.test', 'https://www.cypressgrove.example.test', 4.6, 87, 'audited', 72, 'seed', 'Fictional business for development only.', '2026-08-21 09:15:00+00', '2026-08-21 09:41:00+00'),
  ('10000000-0000-4000-8000-000000000005', 'CurrentPath Electrical', 'Electrical', '11800 W Sample Road', 'Coral Springs', 'FL', '(954) 555-0177', 'jobs@currentpath.example.test', 'https://www.currentpath.example.test', 4.5, 64, 'discovered', 68, 'seed', 'Fictional business for development only.', '2026-08-26 18:02:00+00', '2026-08-26 18:02:00+00'),
  ('10000000-0000-4000-8000-000000000006', 'Oakridge Auto Repair', 'Auto Repair', '210 S Federal Highway', 'Deerfield Beach', 'FL', '(954) 555-0119', 'service@oakridgeauto.example.test', 'https://www.oakridgeauto.example.test', 4.8, 256, 'approved', 84, 'seed', 'Fictional business for development only.', '2026-07-22 13:28:00+00', '2026-08-19 11:33:00+00'),
  ('10000000-0000-4000-8000-000000000007', 'Tidewash Pressure Washing', 'Pressure Washing', '611 Sunrise Boulevard', 'Fort Lauderdale', 'FL', '(954) 555-0188', 'book@tidewash.example.test', 'https://www.tidewash.example.test', 4.9, 178, 'interested', 89, 'seed', 'Fictional business for development only.', '2026-07-15 10:44:00+00', '2026-08-16 09:18:00+00'),
  ('10000000-0000-4000-8000-000000000008', 'Coral Isle Dental', 'Dentistry', '7000 W Palmetto Park Road', 'Boca Raton', 'FL', '(561) 555-0144', 'front@coralisledental.example.test', 'https://www.coralisledental.example.test', 3.9, 41, 'rejected', 34, 'seed', 'Fictional business for development only.', '2026-07-29 15:10:00+00', '2026-07-29 15:48:00+00'),
  ('10000000-0000-4000-8000-000000000009', 'Banyan Air Comfort', 'HVAC', '1301 E Atlantic Boulevard', 'Pompano Beach', 'FL', '(954) 555-0126', 'dispatch@banyanair.example.test', 'https://www.banyanair.example.test', 4.7, 143, 'contacted', 81, 'seed', 'Fictional business for development only.', '2026-08-02 12:00:00+00', '2026-08-21 13:40:00+00'),
  ('10000000-0000-4000-8000-000000000010', 'Seaglass Plumbing Co.', 'Plumbing', '1645 Hillsboro Boulevard', 'Deerfield Beach', 'FL', '(954) 555-0155', 'office@seaglassplumbing.example.test', 'https://www.seaglassplumbing.example.test', 4.6, 96, 'website_built', 79, 'seed', 'Fictional business for development only.', '2026-08-05 17:22:00+00', '2026-08-24 14:02:00+00'),
  ('10000000-0000-4000-8000-000000000011', 'Sawgrass Shield Roofing', 'Roofing', '3111 N University Drive', 'Coral Springs', 'FL', '(954) 555-0104', 'estimates@sawgrassshield.example.test', 'https://www.sawgrassshield.example.test', 4.4, 52, 'discovered', 61, 'seed', 'Fictional business for development only.', '2026-08-27 08:36:00+00', '2026-08-27 08:36:00+00'),
  ('10000000-0000-4000-8000-000000000012', 'Greenline Gardens', 'Landscaping', '4701 W Sample Road', 'Coconut Creek', 'FL', '(954) 555-0137', 'hello@greenlinegardens.example.test', 'https://www.greenlinegardens.example.test', 4.8, 203, 'customer', 90, 'seed', 'Fictional business for development only.', '2026-06-20 09:50:00+00', '2026-08-04 12:00:00+00'),
  ('10000000-0000-4000-8000-000000000013', 'Lakeside Spark Electric', 'Electrical', '920 NE 13th Street', 'Fort Lauderdale', 'FL', '(954) 555-0161', 'crew@lakesidespark.example.test', 'https://www.lakesidespark.example.test', 4.5, 71, 'audited', 70, 'seed', 'Fictional business for development only.', '2026-08-22 19:05:00+00', '2026-08-22 19:33:00+00'),
  ('10000000-0000-4000-8000-000000000014', 'Marlin Bay Auto Care', 'Auto Repair', '890 N Dixie Highway', 'Boca Raton', 'FL', '(561) 555-0172', 'shop@marlinbayauto.example.test', 'https://www.marlinbayauto.example.test', 3.6, 28, 'rejected', 29, 'seed', 'Fictional business for development only.', '2026-08-01 14:18:00+00', '2026-08-01 14:50:00+00')
on conflict (id) do nothing;

insert into public.website_audits (
  id, lead_id, overall_score, design_score, seo_score, mobile_score, performance_score, conversion_score,
  issues, recommendations, summary, created_at, updated_at
) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 38, 32, 41, 28, 51, 30,
    '["Outdated visual design with a 2014-era template","Poor mobile navigation; menu overflows on small screens","Weak metadata and generic page titles","No LocalBusiness structured data","Unoptimized hero and gallery images","Unclear conversion path; phone number buried in the footer"]'::jsonb,
    '["Rebuild with a service-first layout and stronger hierarchy","Improve mobile navigation and tap targets","Add service-focused metadata for plumbing keywords","Add LocalBusiness structured data for Fort Lauderdale","Compress images and lazy-load galleries","Place a persistent call and quote CTA above the fold"]'::jsonb,
    'Strong demand, weak site.', '2026-07-12 15:02:00+00', '2026-07-12 15:02:00+00'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 41, 40, 38, 36, 49, 35,
    '["Stock photography dominates the homepage","Service pages are thin and duplicated","No emergency HVAC callout on mobile","Missing review schema despite strong ratings","Slow banner carousel on first load"]'::jsonb,
    '["Replace stock photos with local crew and job photos","Write distinct pages for AC repair, installation, and maintenance","Add a sticky emergency CTA","Expose review count with structured data","Remove the carousel in favor of a single conversion hero"]'::jsonb,
    'Qualified HVAC lead with a dated marketing site.', '2026-07-08 11:40:00+00', '2026-07-08 11:40:00+00'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 29, 22, 31, 24, 38, 22,
    '["Flash-era layout with poor contrast","No mobile navigation at all","City pages missing despite serving multiple Broward cities","Contact form posts to an unused mailbox","Unoptimized before/after images over 4MB each"]'::jsonb,
    '["Replace the template with a high-contrast trade layout","Add a mobile-first nav and click-to-call","Create location pages for Pompano Beach and nearby cities","Rebuild the quote form with a single conversion path","Compress project photography"]'::jsonb,
    'Exceptional reviews and a very weak site.', '2026-07-18 17:12:00+00', '2026-07-18 17:12:00+00'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 45, 48, 39, 42, 52, 40,
    '["Design is pleasant but generic","Service hierarchy mixes residential and commercial poorly","Weak metadata on gallery pages","No seasonal service landing pages"]'::jsonb,
    '["Separate residential and commercial service trees","Add Boca Raton local SEO metadata","Create seasonal landing pages for lawn, irrigation, and cleanup","Tighten CTA placement on gallery pages"]'::jsonb,
    'Audit complete; still in review.', '2026-08-21 09:41:00+00', '2026-08-21 09:41:00+00'),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006', 36, 30, 37, 33, 44, 32,
    '["Hours and address are inconsistent across pages","No booking path besides a generic contact form","Missing service pages for brakes, AC, and inspections","Unclear conversion path from homepage"]'::jsonb,
    '["Standardize NAP information","Add a simple appointment request flow","Create focused service pages","Surface reviews and warranties near the primary CTA"]'::jsonb,
    'Qualified on reviews and website gap.', '2026-07-22 14:40:00+00', '2026-07-22 14:40:00+00'),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000007', 27, 21, 29, 19, 40, 18,
    '["Single-page site with almost no service detail","Broken mobile navigation","No LocalBusiness structured data","Unoptimized images","No quote path besides a mailto link"]'::jsonb,
    '["Build dedicated pages for house, driveway, and commercial washing","Fix mobile navigation and tap targets","Add structured data and Fort Lauderdale location copy","Compress images","Add a quote form with photo upload"]'::jsonb,
    'Strong demand, almost no website.', '2026-07-15 11:20:00+00', '2026-07-15 11:20:00+00'),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000008', 62, 64, 58, 61, 66, 60,
    '["Website is already above the quality bar for this program","Some specialist pages could be deeper"]'::jsonb,
    '["Do not pursue a replacement website","Lead rejected: business is weaker than the site, not the reverse"]'::jsonb,
    'Rejected: website already outruns demand.', '2026-07-29 15:48:00+00', '2026-07-29 15:48:00+00'),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000009', 40, 37, 42, 35, 46, 34,
    '["Outdated visual design","Weak metadata on service pages","No structured data","Unclear conversion path for emergency vs. scheduled work"]'::jsonb,
    '["Refresh the visual system and typography","Add service-focused metadata","Add LocalBusiness structured data","Split emergency and maintenance CTAs"]'::jsonb,
    'Qualified HVAC follow-up.', '2026-08-02 12:35:00+00', '2026-08-02 12:35:00+00'),
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000010', 31, 26, 34, 22, 43, 24,
    '["Poor mobile navigation","Unoptimized images","No LocalBusiness structured data","Unclear conversion path"]'::jsonb,
    '["Improve mobile navigation","Compress images","Add structured data","Create a clearer service hierarchy"]'::jsonb,
    'Later website build failed.', '2026-08-05 17:55:00+00', '2026-08-05 17:55:00+00'),
  ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000012', 35, 33, 36, 30, 41, 28,
    '["Outdated visual design","Weak metadata","No structured data","Unoptimized images"]'::jsonb,
    '["Rebuild around seasonal services and local proof","Add service-focused metadata","Add structured data","Improve CTA placement"]'::jsonb,
    'Converted to a managed customer.', '2026-06-20 10:30:00+00', '2026-06-20 10:30:00+00'),
  ('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000013', 44, 41, 46, 39, 50, 38,
    '["Generic template with weak brand presence","Service pages lack Fort Lauderdale locality","CTA competes with a large slider"]'::jsonb,
    '["Replace the slider with a single service hero","Add local service copy and structured data","Improve CTA placement"]'::jsonb,
    'Audit queued then completed.', '2026-08-22 19:33:00+00', '2026-08-22 19:33:00+00'),
  ('20000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000014', 55, 52, 49, 57, 61, 48,
    '["Website quality is acceptable relative to demand signals","Review volume is too low to qualify"]'::jsonb,
    '["Do not pursue a replacement website","Lead rejected: weak demand signals, not a poor-site opportunity"]'::jsonb,
    'Rejected on demand signals.', '2026-08-01 14:50:00+00', '2026-08-01 14:50:00+00')
on conflict (id) do nothing;

insert into public.generated_websites (
  id, lead_id, status, template, preview_url, production_url, repository_url, seo_score, metadata, created_at, updated_at
) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'review_required', 'Service Local', 'https://harborline-plumbing.preview.siteforge.local', null, null, 86, '{"before_score":38,"after_score":86}'::jsonb, '2026-08-16 15:10:00+00', '2026-08-16 15:10:00+00'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'approved', 'Service Local', 'https://palmetto-hvac.preview.siteforge.local', null, null, 88, '{"before_score":41,"after_score":88}'::jsonb, '2026-08-10 12:42:00+00', '2026-08-10 12:42:00+00'),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'building', 'Trade Bold', 'https://ridgeway-roofing.preview.siteforge.local', null, null, null, '{"before_score":29}'::jsonb, '2026-08-28 09:05:00+00', '2026-08-28 09:05:00+00'),
  ('30000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000007', 'approved', 'Service Local', 'https://tidewash.preview.siteforge.local', null, null, 91, '{"before_score":27,"after_score":91}'::jsonb, '2026-08-14 18:20:00+00', '2026-08-14 18:20:00+00'),
  ('30000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006', 'review_required', 'Trade Bold', 'https://oakridge-auto.preview.siteforge.local', null, null, 84, '{"before_score":36,"after_score":84}'::jsonb, '2026-08-19 11:33:00+00', '2026-08-19 11:33:00+00'),
  ('30000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000012', 'live', 'Garden Clean', 'https://greenline-gardens.preview.siteforge.local', 'https://www.greenlinegardens.example.test', null, 92, '{"before_score":35,"after_score":92}'::jsonb, '2026-07-28 16:00:00+00', '2026-07-28 16:00:00+00'),
  ('30000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000010', 'failed', 'Service Local', 'https://seaglass-plumbing.preview.siteforge.local', null, null, null, '{"before_score":31}'::jsonb, '2026-08-24 13:47:00+00', '2026-08-24 14:02:00+00'),
  ('30000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000009', 'review_required', 'Coastal Trust', 'https://banyan-air.preview.siteforge.local', null, null, 85, '{"before_score":40,"after_score":85}'::jsonb, '2026-08-20 10:12:00+00', '2026-08-20 10:12:00+00')
on conflict (id) do nothing;

insert into public.agent_runs (
  id, agent_id, lead_id, status, trigger_type, input, output, model,
  input_tokens, output_tokens, estimated_cost_usd, actual_cost_usd, started_at, completed_at, created_at
) values
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'completed', 'manual', '{}'::jsonb, '{"summary":"Scout discovered CurrentPath Electrical in Coral Springs."}'::jsonb, null, 1200, 400, 0.42, 0.42, '2026-08-26 17:50:00+00', '2026-08-26 18:02:00+00', '2026-08-26 17:50:00+00'),
  ('40000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000011', 'completed', 'manual', '{}'::jsonb, '{"summary":"Scout discovered Sawgrass Shield Roofing in Coral Springs."}'::jsonb, null, 1100, 380, 0.38, 0.38, '2026-08-27 08:20:00+00', '2026-08-27 08:36:00+00', '2026-08-27 08:20:00+00'),
  ('40000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 'completed', 'manual', '{}'::jsonb, '{"summary":"Auditor completed a website audit for Cypress Grove Landscaping."}'::jsonb, null, 2400, 900, 0.61, 0.61, '2026-08-21 09:20:00+00', '2026-08-21 09:41:00+00', '2026-08-21 09:20:00+00'),
  ('40000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000013', 'completed', 'manual', '{}'::jsonb, '{"summary":"Auditor completed a website audit for Lakeside Spark Electric."}'::jsonb, null, 2200, 850, 0.57, 0.57, '2026-08-22 19:10:00+00', '2026-08-22 19:33:00+00', '2026-08-22 19:10:00+00'),
  ('40000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'running', 'manual', '{}'::jsonb, '{"summary":"Builder generated a website draft for Ridgeway Roofing."}'::jsonb, null, null, null, 1.20, null, '2026-08-28 09:05:00+00', null, '2026-08-28 09:05:00+00'),
  ('40000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000010', 'failed', 'manual', '{}'::jsonb, '{"summary":"Builder failed while generating Seaglass Plumbing Co."}'::jsonb, null, 1800, 200, 0.88, 0.88, '2026-08-24 13:47:00+00', '2026-08-24 14:02:00+00', '2026-08-24 13:47:00+00'),
  ('40000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'completed', 'manual', '{}'::jsonb, '{"summary":"Sales prepared outreach for Harborline Plumbing."}'::jsonb, null, 900, 500, 0.29, 0.29, '2026-08-17 10:14:00+00', '2026-08-17 10:22:00+00', '2026-08-17 10:14:00+00'),
  ('40000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000012', 'completed', 'manual', '{}'::jsonb, '{"summary":"Manager prepared a seasonal update for Greenline Gardens."}'::jsonb, null, 1000, 420, 0.33, 0.33, '2026-08-25 15:02:00+00', '2026-08-25 15:18:00+00', '2026-08-25 15:02:00+00')
on conflict (id) do nothing;

insert into public.agent_tool_calls (
  id, agent_run_id, tool_name, action, request, response, status, estimated_cost_usd, actual_cost_usd, requires_approval, created_at, completed_at
) values
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000007', 'draft_email', 'prepare_outreach', '{"lead_id":"10000000-0000-4000-8000-000000000001"}'::jsonb, '{"status":"drafted"}'::jsonb, 'completed', 0.05, 0.05, false, '2026-08-17 10:16:00+00', '2026-08-17 10:18:00+00'),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000007', 'send_email', 'send_external_email', '{"lead_id":"10000000-0000-4000-8000-000000000001"}'::jsonb, '{"status":"blocked_pending_approval"}'::jsonb, 'awaiting_approval', 0.00, 0.00, true, '2026-08-17 10:20:00+00', null)
on conflict (id) do nothing;

insert into public.approvals (
  id, agent_run_id, lead_id, approval_type, status, title, description, payload,
  estimated_cost_usd, approved_cost_limit_usd, actual_cost_usd, requested_at, resolved_at, created_at
) values
  ('60000000-0000-4000-8000-000000000002', null, '10000000-0000-4000-8000-000000000002', 'website_deployment', 'pending',
    'Deploy Palmetto Air & Heat to production',
    'Internal review approved the preview. Production publish is an external side effect and requires a human decision.',
    '{"agent_slug":"builder","risk_level":"high"}'::jsonb,
    0, 0, null, '2026-08-18 14:26:00+00', null, '2026-08-18 14:26:00+00'),
  ('60000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', 'external_email', 'pending',
    'Send introduction email to Harborline Plumbing',
    'A personalized draft is ready. Sending email to a real inbox requires approval.',
    '{"agent_slug":"sales","risk_level":"medium"}'::jsonb,
    0, 0, null, '2026-08-17 10:24:00+00', null, '2026-08-17 10:24:00+00'),
  ('60000000-0000-4000-8000-000000000012', '40000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000012', 'website_modification', 'pending',
    'Publish seasonal services update on the live customer site',
    'Greenline Gardens is a managed customer. Customer-facing changes require approval initially.',
    '{"agent_slug":"manager","risk_level":"medium"}'::jsonb,
    0, 0, null, '2026-08-25 15:20:00+00', null, '2026-08-25 15:20:00+00'),
  ('60000000-0000-4000-8000-000000000007', null, '10000000-0000-4000-8000-000000000007', 'payment_action', 'pending',
    'Create a $99 website setup invoice for Tidewash Pressure Washing',
    'The prospect is marked interested. Charges and invoices are privileged actions.',
    '{"agent_slug":"sales","risk_level":"high"}'::jsonb,
    0, 0, null, '2026-08-21 16:08:00+00', null, '2026-08-21 16:08:00+00'),
  ('60000000-0000-4000-8000-000000000006', null, '10000000-0000-4000-8000-000000000006', 'website_deployment', 'pending',
    'Request production deploy for Oakridge Auto Repair',
    'Preview is waiting on website review. Production deployment cannot proceed without approval.',
    '{"agent_slug":"builder","risk_level":"high"}'::jsonb,
    0, 0, null, '2026-08-19 12:02:00+00', null, '2026-08-19 12:02:00+00'),
  ('60000000-0000-4000-8000-000000000009', null, '10000000-0000-4000-8000-000000000009', 'external_email', 'pending',
    'Send follow-up with preview link to Banyan Air Comfort',
    'External email is a side effect. The draft may be edited before approval.',
    '{"agent_slug":"sales","risk_level":"medium"}'::jsonb,
    0, 0, null, '2026-08-22 09:41:00+00', null, '2026-08-22 09:41:00+00')
on conflict (id) do nothing;

insert into public.outreach (
  id, lead_id, agent_run_id, approval_id, subject, body, recipient_email, status, provider_message_id, sent_at, created_at, updated_at
) values
  ('70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000007', '60000000-0000-4000-8000-000000000001', 'A faster site for Harborline Plumbing', 'Draft introducing a rebuilt Fort Lauderdale plumbing site with clearer service pages and a quote path. Sending is blocked until approval exists.', 'owner@harborlineplumbing.example.test', 'awaiting_approval', null, null, '2026-08-17 10:22:00+00', '2026-08-17 10:22:00+00'),
  ('70000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', null, null, 'Preview: Palmetto Air & Heat', 'Sample sent message sharing a preview URL. No email provider is connected.', 'hello@palmettoair.example.test', 'sent', null, '2026-08-12 14:15:00+00', '2026-08-12 14:15:00+00', '2026-08-12 16:08:00+00'),
  ('70000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000007', null, null, 'Your new Tidewash site is ready to review', 'Sample thread where the prospect replied and asked about setup pricing.', 'book@tidewash.example.test', 'replied', null, '2026-08-15 11:30:00+00', '2026-08-15 11:30:00+00', '2026-08-16 09:18:00+00'),
  ('70000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006', null, null, 'A cleaner site for Oakridge Auto Repair', 'Internal draft only. Not submitted for approval yet.', 'service@oakridgeauto.example.test', 'draft', null, null, '2026-08-19 12:00:00+00', '2026-08-19 12:00:00+00'),
  ('70000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000009', null, '60000000-0000-4000-8000-000000000009', 'Banyan Air Comfort website preview', 'Sample sent follow-up. Opened, no click or reply yet.', 'dispatch@banyanair.example.test', 'sent', null, '2026-08-21 13:40:00+00', '2026-08-21 13:40:00+00', '2026-08-21 18:12:00+00'),
  ('70000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000012', null, null, 'Greenline Gardens — new site and managed plan', 'Sample historical thread that converted into a managed customer.', 'hello@greenlinegardens.example.test', 'replied', null, '2026-07-30 10:00:00+00', '2026-07-30 10:00:00+00', '2026-07-31 15:45:00+00'),
  ('70000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000010', null, null, 'Website rebuild for Seaglass Plumbing Co.', 'Sample declined reply. No further sending is scheduled.', 'office@seaglassplumbing.example.test', 'replied', null, '2026-08-08 09:12:00+00', '2026-08-08 09:12:00+00', '2026-08-09 08:05:00+00'),
  ('70000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', null, null, 'Ridgeway Roofing website draft', 'Internal draft while the website is still building.', 'office@ridgewayroofing.example.test', 'draft', null, null, '2026-08-28 10:00:00+00', '2026-08-28 10:00:00+00'),
  ('70000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000008', null, null, 'Quick question about Coral Isle Dental', 'Sample unsubscribed event from an early outreach test. Sending is not implemented.', 'front@coralisledental.example.test', 'sent', null, '2026-08-03 14:00:00+00', '2026-08-03 14:00:00+00', '2026-08-03 14:20:00+00')
on conflict (id) do nothing;

insert into public.outreach_events (id, outreach_id, event_type, payload, occurred_at, created_at) values
  ('80000000-0000-4000-8000-000000000201', '70000000-0000-4000-8000-000000000002', 'opened', '{}'::jsonb, '2026-08-12 16:02:00+00', '2026-08-12 16:02:00+00'),
  ('80000000-0000-4000-8000-000000000202', '70000000-0000-4000-8000-000000000002', 'clicked', '{}'::jsonb, '2026-08-12 16:08:00+00', '2026-08-12 16:08:00+00'),
  ('80000000-0000-4000-8000-000000000701', '70000000-0000-4000-8000-000000000007', 'opened', '{}'::jsonb, '2026-08-15 12:04:00+00', '2026-08-15 12:04:00+00'),
  ('80000000-0000-4000-8000-000000000702', '70000000-0000-4000-8000-000000000007', 'clicked', '{}'::jsonb, '2026-08-15 12:06:00+00', '2026-08-15 12:06:00+00'),
  ('80000000-0000-4000-8000-000000000703', '70000000-0000-4000-8000-000000000007', 'replied', '{}'::jsonb, '2026-08-16 09:18:00+00', '2026-08-16 09:18:00+00'),
  ('80000000-0000-4000-8000-000000000704', '70000000-0000-4000-8000-000000000007', 'interested', '{}'::jsonb, '2026-08-16 09:18:00+00', '2026-08-16 09:18:00+00'),
  ('80000000-0000-4000-8000-000000000901', '70000000-0000-4000-8000-000000000009', 'opened', '{}'::jsonb, '2026-08-21 18:12:00+00', '2026-08-21 18:12:00+00'),
  ('80000000-0000-4000-8000-000000001201', '70000000-0000-4000-8000-000000000012', 'opened', '{}'::jsonb, '2026-07-30 10:22:00+00', '2026-07-30 10:22:00+00'),
  ('80000000-0000-4000-8000-000000001202', '70000000-0000-4000-8000-000000000012', 'clicked', '{}'::jsonb, '2026-07-30 10:24:00+00', '2026-07-30 10:24:00+00'),
  ('80000000-0000-4000-8000-000000001203', '70000000-0000-4000-8000-000000000012', 'replied', '{}'::jsonb, '2026-07-31 15:45:00+00', '2026-07-31 15:45:00+00'),
  ('80000000-0000-4000-8000-000000001001', '70000000-0000-4000-8000-000000000010', 'opened', '{}'::jsonb, '2026-08-08 11:40:00+00', '2026-08-08 11:40:00+00'),
  ('80000000-0000-4000-8000-000000001002', '70000000-0000-4000-8000-000000000010', 'replied', '{}'::jsonb, '2026-08-09 08:05:00+00', '2026-08-09 08:05:00+00'),
  ('80000000-0000-4000-8000-000000001003', '70000000-0000-4000-8000-000000000010', 'declined', '{}'::jsonb, '2026-08-09 08:05:00+00', '2026-08-09 08:05:00+00'),
  ('80000000-0000-4000-8000-000000000801', '70000000-0000-4000-8000-000000000008', 'opened', '{}'::jsonb, '2026-08-03 14:20:00+00', '2026-08-03 14:20:00+00'),
  ('80000000-0000-4000-8000-000000000802', '70000000-0000-4000-8000-000000000008', 'unsubscribed', '{}'::jsonb, '2026-08-03 14:20:00+00', '2026-08-03 14:20:00+00')
on conflict (id) do nothing;

insert into public.customers (
  id, lead_id, business_name, contact_name, contact_email, plan, status, production_url, created_at, updated_at
) values
  ('90000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000012', 'Greenline Gardens', null, 'hello@greenlinegardens.example.test', 'managed', 'active', 'https://www.greenlinegardens.example.test', '2026-08-04 12:00:00+00', '2026-08-04 12:00:00+00'),
  ('90000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Palmetto Air & Heat', null, 'hello@palmettoair.example.test', 'website_only', 'active', 'https://palmetto-hvac.preview.siteforge.local', '2026-08-12 16:30:00+00', '2026-08-12 16:30:00+00'),
  ('90000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000007', 'Tidewash Pressure Washing', null, 'book@tidewash.example.test', 'managed', 'pending_setup', 'https://tidewash.preview.siteforge.local', '2026-08-20 10:15:00+00', '2026-08-20 10:15:00+00')
on conflict (id) do nothing;

insert into public.subscriptions (
  id, customer_id, provider, provider_customer_id, provider_subscription_id, amount_usd, interval, status, started_at, cancelled_at, created_at, updated_at
) values
  ('a0000000-0000-4000-8000-000000000012', '90000000-0000-4000-8000-000000000012', 'stripe', null, null, 39, 'month', 'active', '2026-08-04 12:00:00+00', null, '2026-08-04 12:00:00+00', '2026-08-04 12:00:00+00'),
  ('a0000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000002', 'stripe', null, null, 99, 'one_time', 'active', '2026-08-12 16:30:00+00', null, '2026-08-12 16:30:00+00', '2026-08-12 16:30:00+00'),
  ('a0000000-0000-4000-8000-000000000007', '90000000-0000-4000-8000-000000000007', 'stripe', null, null, 39, 'month', 'pending', '2026-08-20 10:15:00+00', null, '2026-08-20 10:15:00+00', '2026-08-20 10:15:00+00')
on conflict (id) do nothing;

insert into public.integration_status (id, integration, status, last_checked_at, metadata, created_at, updated_at) values
  ('b0000000-0000-4000-8000-000000000001', 'supabase', 'connected', now(), '{"purpose":"Database, authentication, application state"}'::jsonb, now(), now()),
  ('b0000000-0000-4000-8000-000000000002', 'xai', 'not_connected', now(), '{"purpose":"Grok agent execution"}'::jsonb, now(), now()),
  ('b0000000-0000-4000-8000-000000000003', 'email', 'not_connected', now(), '{"purpose":"Outbound and inbound email"}'::jsonb, now(), now()),
  ('b0000000-0000-4000-8000-000000000004', 'payments', 'not_connected', now(), '{"purpose":"Payments and subscriptions"}'::jsonb, now(), now()),
  ('b0000000-0000-4000-8000-000000000005', 'deployments', 'not_connected', now(), '{"purpose":"Preview and production deployments"}'::jsonb, now(), now())
on conflict (integration) do nothing;

insert into public.activity_events (
  id, event_type, actor_type, actor_id, lead_id, customer_id, title, description, metadata, created_at
) values
  ('c0000000-0000-4000-8000-000000000101', 'lead_discovered', 'agent', 'scout', '10000000-0000-4000-8000-000000000001', null, 'Lead discovered', 'Harborline Plumbing added from a Fort Lauderdale plumbing search.', '{}'::jsonb, '2026-07-12 14:20:00+00'),
  ('c0000000-0000-4000-8000-000000000102', 'audit_queued', 'agent', 'auditor', '10000000-0000-4000-8000-000000000001', null, 'Audit queued', 'Public website queued for Auditor review.', '{}'::jsonb, '2026-07-12 14:28:00+00'),
  ('c0000000-0000-4000-8000-000000000103', 'audit_completed', 'agent', 'auditor', '10000000-0000-4000-8000-000000000001', null, 'Audit completed', 'Overall website score 38. Strong demand, weak site.', '{}'::jsonb, '2026-07-12 15:02:00+00'),
  ('c0000000-0000-4000-8000-000000000104', 'lead_qualified', 'system', null, '10000000-0000-4000-8000-000000000001', null, 'Lead qualified', 'Qualified on rating, review volume, and website gap.', '{}'::jsonb, '2026-07-13 09:10:00+00'),
  ('c0000000-0000-4000-8000-000000000201', 'lead_discovered', 'agent', 'scout', '10000000-0000-4000-8000-000000000002', null, 'Lead discovered', 'Palmetto Air & Heat added from Coconut Creek HVAC search.', '{}'::jsonb, '2026-07-08 11:05:00+00'),
  ('c0000000-0000-4000-8000-000000000202', 'audit_completed', 'agent', 'auditor', '10000000-0000-4000-8000-000000000002', null, 'Audit completed', 'Overall website score 41.', '{}'::jsonb, '2026-07-08 11:40:00+00'),
  ('c0000000-0000-4000-8000-000000000203', 'lead_qualified', 'system', null, '10000000-0000-4000-8000-000000000002', null, 'Lead qualified', 'Moved to qualified after audit.', '{}'::jsonb, '2026-07-09 08:15:00+00'),
  ('c0000000-0000-4000-8000-000000000204', 'website_generated', 'agent', 'builder', '10000000-0000-4000-8000-000000000002', null, 'Website generated', 'Preview created with the Service Local template.', '{}'::jsonb, '2026-08-10 12:42:00+00'),
  ('c0000000-0000-4000-8000-000000001201', 'lead_discovered', 'agent', 'scout', '10000000-0000-4000-8000-000000000012', null, 'Lead discovered', 'Greenline Gardens added from Coconut Creek landscaping search.', '{}'::jsonb, '2026-06-20 09:50:00+00'),
  ('c0000000-0000-4000-8000-000000001202', 'audit_completed', 'agent', 'auditor', '10000000-0000-4000-8000-000000000012', null, 'Audit completed', 'Overall website score 35.', '{}'::jsonb, '2026-06-20 10:30:00+00'),
  ('c0000000-0000-4000-8000-000000001203', 'lead_qualified', 'system', null, '10000000-0000-4000-8000-000000000012', null, 'Lead qualified', 'High review volume and a weak existing site.', '{}'::jsonb, '2026-06-21 09:00:00+00'),
  ('c0000000-0000-4000-8000-000000001204', 'became_customer', 'system', null, '10000000-0000-4000-8000-000000000012', '90000000-0000-4000-8000-000000000012', 'Became a customer', 'Managed plan at $39/month. Production site is live.', '{}'::jsonb, '2026-08-04 12:00:00+00'),
  ('c0000000-0000-4000-8000-000000000301', 'lead_discovered', 'agent', 'scout', '10000000-0000-4000-8000-000000000003', null, 'Lead discovered', 'Ridgeway Roofing added from Pompano Beach roofing search.', '{}'::jsonb, '2026-07-18 16:40:00+00'),
  ('c0000000-0000-4000-8000-000000000302', 'audit_completed', 'agent', 'auditor', '10000000-0000-4000-8000-000000000003', null, 'Audit completed', 'Overall website score 29.', '{}'::jsonb, '2026-07-18 17:12:00+00'),
  ('c0000000-0000-4000-8000-000000000303', 'lead_qualified', 'system', null, '10000000-0000-4000-8000-000000000003', null, 'Lead qualified', 'Exceptional reviews and a very weak site.', '{}'::jsonb, '2026-07-19 08:40:00+00'),
  ('c0000000-0000-4000-8000-000000000304', 'website_build_started', 'agent', 'builder', '10000000-0000-4000-8000-000000000003', null, 'Website build started', 'Builder run is sample data only. The agent is not implemented.', '{}'::jsonb, '2026-08-28 09:05:00+00'),
  ('c0000000-0000-4000-8000-000000000501', 'lead_discovered', 'agent', 'scout', '10000000-0000-4000-8000-000000000005', null, 'Lead discovered', 'CurrentPath Electrical added from Coral Springs search.', '{}'::jsonb, '2026-08-26 18:02:00+00'),
  ('c0000000-0000-4000-8000-000000001101', 'lead_discovered', 'agent', 'scout', '10000000-0000-4000-8000-000000000011', null, 'Lead discovered', 'Sawgrass Shield Roofing added from Coral Springs search.', '{}'::jsonb, '2026-08-27 08:36:00+00')
on conflict (id) do nothing;

