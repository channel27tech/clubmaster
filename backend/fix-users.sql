-- Make sure all users have a valid username
-- First, identify if we're using camelCase or snake_case column names
DO $$
DECLARE
    has_display_name_column boolean;
    has_email_column boolean;
BEGIN
    -- Check if displayName column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'displayName'
    ) INTO has_display_name_column;

    -- Check if email column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'email'
    ) INTO has_email_column;

    -- Update users with camelCase columns
    IF has_display_name_column AND has_email_column THEN
        UPDATE users 
        SET username = COALESCE("displayName", SPLIT_PART(email, '@', 1), 'user_' || id) 
        WHERE username IS NULL;
        RAISE NOTICE 'Updated users with camelCase columns';
    -- Update users with snake_case columns
    ELSE
        UPDATE users 
        SET username = COALESCE(display_name, SPLIT_PART(email, '@', 1), 'user_' || id) 
        WHERE username IS NULL;
        RAISE NOTICE 'Updated users with snake_case columns';
    END IF;
END $$;

-- Update the updatedAt timestamp
DO $$
DECLARE
    has_updated_at_column boolean;
BEGIN
    -- Check if updatedAt column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'updatedAt'
    ) INTO has_updated_at_column;

    -- Update timestamp with proper column name
    IF has_updated_at_column THEN
        EXECUTE 'UPDATE users SET "updatedAt" = NOW()';
        RAISE NOTICE 'Updated updatedAt column';
    ELSE
        EXECUTE 'UPDATE users SET updated_at = NOW()';
        RAISE NOTICE 'Updated updated_at column';
    END IF;
END $$; 