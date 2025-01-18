/*
  # Create files table for cloud storage

  1. New Tables
    - `files`
      - `id` (uuid, primary key)
      - `name` (text)
      - `size` (bigint)
      - `type` (text)
      - `file_type` (text)
      - `storage_path` (text)
      - `user_id` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `modified_at` (timestamptz)

  2. Security
    - Enable RLS on `files` table
    - Add policies for authenticated users to:
      - Read their own files
      - Create new files
      - Update their own files
      - Delete their own files
*/

CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  size bigint NOT NULL,
  type text NOT NULL,
  file_type text,
  storage_path text,
  user_id uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now(),
  modified_at timestamptz DEFAULT now()
);

ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to read their own files
CREATE POLICY "Users can read own files"
  ON files
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy to allow users to create files
CREATE POLICY "Users can create files"
  ON files
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to update their own files
CREATE POLICY "Users can update own files"
  ON files
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to delete their own files
CREATE POLICY "Users can delete own files"
  ON files
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);