-- Seed: Official SaaS Templates

-- Template 1: SaaS B2B Starter
INSERT INTO saas_blueprint_templates (
  id, slug, name, description, vertical, tier,
  default_entitlements_json,
  default_branding_json,
  stripe_pricing_tiers_json,
  tagline, key_features_json, target_audience, use_cases_json,
  is_official, is_featured
) VALUES (
  'tpl_saas_b2b_starter',
  'saas-b2b-starter',
  'SaaS B2B Starter',
  'Complete B2B SaaS platform with CRM, billing, and customer management. Perfect for startups building their first SaaS product.',
  'SAAS',
  'free',
  '{
    "packs": ["crm", "support"],
    "features": ["customer_management", "basic_reporting", "email_integration", "api_access"],
    "limits": {"max_users": 10, "max_contacts": 1000, "api_calls_per_month": 10000}
  }',
  '{
    "colors": {"primary": "#3B82F6", "secondary": "#10B981"},
    "fonts": {"heading": "Inter", "body": "Inter"}
  }',
  '[
    {"name": "Starter", "monthly": 49, "yearly": 490, "features": ["CRM", "Basic Support", "API Access"]},
    {"name": "Professional", "monthly": 99, "yearly": 990, "features": ["CRM", "Priority Support", "API", "Webhooks", "Social Media"]},
    {"name": "Enterprise", "monthly": 299, "yearly": 2990, "features": ["Everything", "SSO", "Premium Support", "Custom Integration"]}
  ]',
  'Launch your B2B SaaS in hours, not months',
  '["CRM with contact management", "Customer portal", "Subscription billing", "API & webhooks", "Email automation", "Basic analytics"]',
  'Startups and SMBs building B2B SaaS products',
  '["Customer relationship management", "SaaS billing platform", "Partner portal", "B2B marketplace"]',
  TRUE,
  TRUE
);

-- Template 2: E-commerce Essential
INSERT INTO saas_blueprint_templates (
  id, slug, name, description, vertical, tier,
  default_entitlements_json,
  default_branding_json,
  stripe_pricing_tiers_json,
  tagline, key_features_json, target_audience, use_cases_json,
  is_official, is_featured
) VALUES (
  'tpl_ecommerce_essential',
  'ecommerce-essential',
  'E-commerce Essential',
  'Complete online store solution with product catalog, shopping cart, and payment processing. Everything you need to start selling online.',
  'ECOMMERCE',
  'free',
  '{
    "packs": ["ecommerce"],
    "features": ["product_catalog", "shopping_cart", "payment_processing", "inventory_management"],
    "limits": {"max_products": 100, "max_orders_per_month": 500, "storage_gb": 10}
  }',
  '{
    "colors": {"primary": "#F59E0B", "secondary": "#EF4444"},
    "fonts": {"heading": "Outfit", "body": "Inter"}
  }',
  '[
    {"name": "Basic", "monthly": 29, "yearly": 290, "features": ["100 products", "Unlimited orders", "Basic reports"]},
    {"name": "Growth", "monthly": 79, "yearly": 790, "features": ["1000 products", "Marketing tools", "Analytics", "Inventory"]},
    {"name": "Pro", "monthly": 199, "yearly": 1990, "features": ["Unlimited products", "Multi-location", "Advanced analytics", "API"]}
  ]',
  'Your online store, ready in minutes',
  '["Product catalog with variants", "Shopping cart & checkout", "Stripe payment integration", "Inventory tracking", "Order management", "Customer accounts"]',
  'Small to medium online retailers',
  '["Online store", "Digital products shop", "Physical goods e-commerce", "Dropshipping store"]',
  TRUE,
  TRUE
);

-- Template 3: Educational Platform
INSERT INTO saas_blueprint_templates (
  id, slug, name, description, vertical, tier,
  default_entitlements_json,
  default_branding_json,
  stripe_pricing_tiers_json,
  tagline, key_features_json, target_audience, use_cases_json,
  is_official, is_featured
) VALUES (
  'tpl_educational_platform',
  'educational-platform',
  'Educational Platform',
  'Learning management system for educators. Create courses, manage students, track progress, and deliver engaging online education.',
  'EDUCATION',
  'free',
  '{
    "packs": ["education"],
    "features": ["course_management", "student_tracking", "progress_reports", "assignments", "grading"],
    "limits": {"max_students": 50, "max_courses": 20, "storage_gb": 25}
  }',
  '{
    "colors": {"primary": "#8B5CF6", "secondary": "#EC4899"},
    "fonts": {"heading": "Poppins", "body": "Inter"}
  }',
  '[
    {"name": "Teacher", "monthly": 39, "yearly": 390, "features": ["50 students", "Unlimited courses", "Basic analytics"]},
    {"name": "School", "monthly": 149, "yearly": 1490, "features": ["500 students", "Parent portal", "Advanced reports", "API"]},
    {"name": "District", "monthly": 499, "yearly": 4990, "features": ["Unlimited students", "SSO", "White-label", "Premium support"]}
  ]',
  'Empower education with modern learning tools',
  '["Course builder with multimedia", "Student enrollment & management", "Assignment submission & grading", "Progress tracking", "Discussion forums", "Parent/student portals"]',
  'Teachers, schools, and educational institutions',
  '["Online courses", "School LMS", "Corporate training", "Tutoring platform"]',
  TRUE,
  TRUE
);

-- Template 4: Agency Portfolio
INSERT INTO saas_blueprint_templates (
  id, slug, name, description, vertical, tier,
  default_entitlements_json,
  default_branding_json,
  stripe_pricing_tiers_json,
  tagline, key_features_json, target_audience, use_cases_json,
  is_official, is_featured
) VALUES (
  'tpl_agency_portfolio',
  'agency-portfolio',
  'Agency Portfolio',
  'Client management platform for creative agencies. Manage projects, clients, invoicing, and showcase your portfolio.',
  'AGENCY',
  'free',
  '{
    "packs": ["crm", "projects"],
    "features": ["client_management", "project_tracking", "invoicing", "time_tracking", "portfolio"],
    "limits": {"max_clients": 25, "max_projects": 50, "storage_gb": 50}
  }',
  '{
    "colors": {"primary": "#0EA5E9", "secondary": "#6366F1"},
    "fonts": {"heading": "Montserrat", "body": "Inter"}
  }',
  '[
    {"name": "Freelancer", "monthly": 29, "yearly": 290, "features": ["5 active projects", "Basic invoicing", "Portfolio"]},
    {"name": "Studio", "monthly": 99, "yearly": 990, "features": ["Unlimited projects", "Team collaboration", "Advanced invoicing", "Client portal"]},
    {"name": "Agency", "monthly": 249, "yearly": 2490, "features": ["White-label", "Multi-brand", "Advanced reports", "API"]}
  ]',
  'Run your agency like a pro',
  '["Client portal", "Project management", "Time tracking", "Invoicing & payments", "Portfolio showcase", "File sharing"]',
  'Creative agencies and freelancers',
  '["Design agency", "Marketing agency", "Development studio", "Consulting firm"]',
  TRUE,
  FALSE
);

-- Template 5: Community Platform
INSERT INTO saas_blueprint_templates (
  id, slug, name, description, vertical, tier,
  default_entitlements_json,
  default_branding_json,
  stripe_pricing_tiers_json,
  tagline, key_features_json, target_audience, use_cases_json,
  is_official, is_featured
) VALUES (
  'tpl_community_platform',
  'community-platform',
  'Community Platform',
  'Build engaged communities with forums, events, memberships, and content. Perfect for creators and community builders.',
  'COMMUNITY',
  'free',
  '{
    "packs": ["community", "social_media"],
    "features": ["forums", "member_profiles", "events", "content_posts", "moderation"],
    "limits": {"max_members": 500, "max_posts_per_month": 10000, "storage_gb": 100}
  }',
  '{
    "colors": {"primary": "#14B8A6", "secondary": "#F59E0B"},
    "fonts": {"heading": "Raleway", "body": "Inter"}
  }',
  '[
    {"name": "Starter", "monthly": 49, "yearly": 490, "features": ["500 members", "Basic forums", "Events"]},
    {"name": "Growth", "monthly": 149, "yearly": 1490, "features": ["5000 members", "Advanced moderation", "Analytics", "Email campaigns"]},
    {"name": "Scale", "monthly": 399, "yearly": 3990, "features": ["Unlimited members", "White-label", "API", "Premium support"]}
  ]',
  'Build thriving communities that connect',
  '["Discussion forums", "Member profiles & directory", "Events calendar", "Content publishing", "Membership tiers", "Email notifications"]',
  'Community builders, creators, and brands',
  '["Online community", "Member forum", "Creator community", "Brand community"]',
  TRUE,
  FALSE
);
