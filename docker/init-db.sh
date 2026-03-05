#!/bin/bash

# Clinical Trials Database Initialization Script
# This script initializes the PostgreSQL database with sample schema

PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB << EOF

-- Create tables for clinical trials
CREATE TABLE IF NOT EXISTS studies (
    id SERIAL PRIMARY KEY,
    nct_id VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50),
    phase VARCHAR(50),
    recruitment_status VARCHAR(100),
    sponsor_name VARCHAR(255),
    start_date DATE,
    primary_completion_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS eligibility_criteria (
    id SERIAL PRIMARY KEY,
    study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    minimum_age VARCHAR(100),
    maximum_age VARCHAR(100),
    gender VARCHAR(50),
    accepts_healthy_volunteers BOOLEAN DEFAULT FALSE,
    criteria TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS participants (
    id SERIAL PRIMARY KEY,
    study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    enrollment_status VARCHAR(50),
    target_enrollment INTEGER,
    actual_enrollment INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_studies_nct_id ON studies(nct_id);
CREATE INDEX IF NOT EXISTS idx_studies_status ON studies(status);
CREATE INDEX IF NOT EXISTS idx_eligibility_study_id ON eligibility_criteria(study_id);
CREATE INDEX IF NOT EXISTS idx_participants_study_id ON participants(study_id);

-- Insert sample data for testing
INSERT INTO studies (nct_id, title, description, status, phase, recruitment_status, sponsor_name, start_date)
VALUES 
    ('NCT04641234', 'Sample COVID-19 Vaccine Trial', 'A randomized controlled trial of COVID-19 vaccine effectiveness', 'Active', 'Phase 3', 'Recruiting', 'National Institute of Health', '2021-01-15'),
    ('NCT04567890', 'Diabetes Treatment Study', 'Testing new diabetes management approach', 'Enrolling by Invitation', 'Phase 2', 'Enrolling by Invitation', 'Medical Research Foundation', '2021-06-01')
ON CONFLICT (nct_id) DO NOTHING;

-- Insert sample eligibility criteria
INSERT INTO eligibility_criteria (study_id, minimum_age, maximum_age, gender, accepts_healthy_volunteers, criteria)
SELECT id, '18 Years', '75 Years', 'All', TRUE, 'Healthy volunteers without chronic diseases'
FROM studies WHERE nct_id = 'NCT04641234'
ON CONFLICT DO NOTHING;

-- Insert sample participants
INSERT INTO participants (study_id, enrollment_status, target_enrollment, actual_enrollment)
SELECT id, 'Open for Enrollment', 5000, 2500
FROM studies WHERE nct_id = 'NCT04641234'
ON CONFLICT DO NOTHING;

GRANT ALL PRIVILEGES ON DATABASE clinicaltrials TO postgres;

EOF

echo "Database initialization completed!"
