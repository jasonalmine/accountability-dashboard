-- EXAMPLE curriculum. Replace the module_index rows with your own course.
--
-- Two rules the app depends on:
--   1. `lessons` per visible module must sum to the total your course platform
--      shows members. That total is the denominator for every percentage.
--   2. `sort_order` is the order members work through. Progress is a single
--      cumulative lesson count, so the order decides which module a member is
--      "in" at any count.
--
-- Modules deliberately vary in size: the dashboard's bottleneck chart is most
-- useful precisely because a 20-lesson module stalls people and a 4-lesson one
-- does not.

INSERT INTO batches (name, sort_order)
SELECT 'Batch ' || g, g FROM generate_series(1, 12) g
ON CONFLICT (name) DO NOTHING;

-- Stages let the denominator change as members advance: content that unlocks
-- later makes the total grow. If your course never unlocks more, give every
-- stage the same denominator.
INSERT INTO stages (name, denominator, sort_order, note) VALUES
  ('In Progress', 100, 1, 'Working through the core curriculum'),
  ('Completed',   100, 2, 'Finished the core curriculum'),
  ('Advanced',    100, 3, 'Update this denominator if advanced content adds lessons')
ON CONFLICT (name) DO NOTHING;

INSERT INTO module_index (module_key, module_no, label, lessons, phase, visible_precert, sort_order) VALUES
  ('START',     NULL, 'Start Here',                      3,  'Core',     TRUE,  0),
  ('MODULE 1',  1,    'Module 1: Foundations',           8,  'Core',     TRUE,  1),
  ('MODULE 2',  2,    'Module 2: Core Concepts',         20, 'Core',     TRUE,  2),
  ('MODULE 3',  3,    'Module 3: Working with Data',     12, 'Core',     TRUE,  3),
  ('MODULE 4',  4,    'Module 4: Building Things',       18, 'Core',     TRUE,  4),
  ('MODULE 5',  5,    'Module 5: Templates and Assets',  9,  'Core',     TRUE,  5),
  ('MODULE 6',  6,    'Module 6: Tracking Progress',     5,  'Core',     TRUE,  6),
  ('MODULE 7',  7,    'Module 7: Automation',            10, 'Core',     TRUE,  7),
  ('MODULE 8',  8,    'Module 8: Reporting',             6,  'Core',     TRUE,  8),
  ('MODULE 9',  9,    'Module 9: Putting It Together',   9,  'Core',     TRUE,  9),
  ('MODULE 10', 10,   'Module 10: Advanced (locked)',    NULL, 'Advanced', FALSE, 10)
ON CONFLICT (module_key) DO NOTHING;
