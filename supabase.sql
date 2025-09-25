-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.presence (
  uid uuid NOT NULL,
  display_name text,
  last_active_at timestamp with time zone DEFAULT now(),
  CONSTRAINT presence_pkey PRIMARY KEY (uid)
);
CREATE TABLE public.state (
  id text NOT NULL,
  current_track_id uuid,
  position numeric,
  is_playing boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT now(),
  host_uid uuid,
  CONSTRAINT state_pkey PRIMARY KEY (id),
  CONSTRAINT state_current_track_id_fkey FOREIGN KEY (current_track_id) REFERENCES public.tracks(id)
);
CREATE TABLE public.tracks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist text,
  storage_path text NOT NULL,
  download_url text NOT NULL,
  duration integer NOT NULL DEFAULT 0,
  uploader_id uuid NOT NULL,
  uploader_badge text,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tracks_pkey PRIMARY KEY (id)
);
