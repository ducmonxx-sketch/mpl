-- Add DITUGASKAN to ShipmentStatus enum (driver assigned, staging before departure)
-- PostgreSQL ADD VALUE is non-transactional and cannot be rolled back.
ALTER TYPE "ShipmentStatus" ADD VALUE 'DITUGASKAN' AFTER 'PENDING';
