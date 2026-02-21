-- Migration pour ajouter les colonnes de fact-checking aux messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS web_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS citations JSONB DEFAULT '[]'::jsonb;
