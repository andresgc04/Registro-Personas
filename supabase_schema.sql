-- ====================================================================
-- Script SQL para Supabase - Sistema de Registro de Personas MVC
-- Estándares OWASP: Almacenamiento seguro, índices ciegos y RLS
-- ====================================================================

-- Extensión UUID si no está activa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Administradores
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    permisos JSONB DEFAULT '[]'::jsonb,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Personas Registradas
-- Nota de Seguridad OWASP:
-- cedula_enc, telefono_enc, email_enc almacenan el texto cifrado con AES-256-GCM.
-- cedula_hash y email_hash almacenan el HMAC-SHA256 para validación de unicidad y búsqueda indexada sin descifrar.
CREATE TABLE IF NOT EXISTS public.personas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    sexo VARCHAR(20) NOT NULL CHECK (sexo IN ('M', 'F', 'Otro')),
    
    -- Campos cifrados AES-256-GCM (IV:Tag:Ciphertext en base64/hex)
    cedula_enc TEXT NOT NULL,
    telefono_enc TEXT NOT NULL,
    email_enc TEXT,
    
    -- Blind Index Hash (HMAC-SHA-256) para índices rápidos y verificación de duplicados
    cedula_hash VARCHAR(64) UNIQUE NOT NULL,
    email_hash VARCHAR(64),
    
    -- Datos demográficos y de contacto
    sector VARCHAR(120) NOT NULL,
    direccion TEXT NOT NULL,
    colegio_electoral VARCHAR(180),
    
    -- Estado de la persona (Activa / Inactiva para seguimiento y boletines)
    activo BOOLEAN DEFAULT TRUE,
    verificado_partido BOOLEAN DEFAULT FALSE,
    
    -- Metadatos de auditoría
    origen_registro VARCHAR(50) DEFAULT 'admin', -- 'admin' o 'publico'
    ip_origen VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_personas_cedula_hash ON public.personas(cedula_hash);
CREATE INDEX IF NOT EXISTS idx_personas_sector ON public.personas(sector);
CREATE INDEX IF NOT EXISTS idx_personas_sexo ON public.personas(sexo);
CREATE INDEX IF NOT EXISTS idx_personas_activo ON public.personas(activo);

-- 3. Tabla de Boletines Informativos Enviados
CREATE TABLE IF NOT EXISTS public.boletines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    canal VARCHAR(20) NOT NULL CHECK (canal IN ('email', 'whatsapp', 'ambos')),
    destinatarios_count INTEGER DEFAULT 0,
    imagenes JSONB DEFAULT '[]'::jsonb,
    enviado_por UUID REFERENCES public.admins(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Trigger para auto-actualizar updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_personas_updated_at
BEFORE UPDATE ON public.personas
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE OR REPLACE TRIGGER trg_admins_updated_at
BEFORE UPDATE ON public.admins
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- 5. Row Level Security (RLS) en Supabase
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boletines ENABLE ROW LEVEL SECURITY;

-- Política de acceso usando Service Role o autenticación
-- Por defecto el backend utiliza la Service Key para realizar operaciones de administración protegidas
CREATE POLICY "Service role full access personas" ON public.personas
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access admins" ON public.admins
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access boletines" ON public.boletines
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 4. TABLA DE COLEGIOS ELECTORALES
CREATE TABLE IF NOT EXISTS public.colegios_electorales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(30) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    municipio VARCHAR(100) NOT NULL,
    sector VARCHAR(120) NOT NULL,
    direccion VARCHAR(250) NOT NULL,
    mesas INTEGER DEFAULT 1,
    electores INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_colegios_codigo ON public.colegios_electorales(codigo);
CREATE INDEX IF NOT EXISTS idx_colegios_municipio ON public.colegios_electorales(municipio);
CREATE INDEX IF NOT EXISTS idx_colegios_sector ON public.colegios_electorales(sector);
CREATE INDEX IF NOT EXISTS idx_colegios_activo ON public.colegios_electorales(activo);

-- RLS
ALTER TABLE public.colegios_electorales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access colegios" ON public.colegios_electorales
    FOR ALL
    USING (true)
    WITH CHECK (true);
