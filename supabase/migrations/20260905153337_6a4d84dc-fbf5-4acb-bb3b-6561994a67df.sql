ALTER TABLE public.boxes ADD COLUMN IF NOT EXISTS state_registration text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.is_valid_cpf(_v text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d text := regexp_replace(coalesce(_v,''), '\D', '', 'g'); s int; r int; i int;
BEGIN
  IF length(d) <> 11 OR d ~ '^(\d)\1{10}$' THEN RETURN false; END IF;
  s := 0; FOR i IN 1..9 LOOP s := s + substr(d,i,1)::int * (11 - i); END LOOP;
  r := (s * 10) % 11; IF r = 10 THEN r := 0; END IF;
  IF r <> substr(d,10,1)::int THEN RETURN false; END IF;
  s := 0; FOR i IN 1..10 LOOP s := s + substr(d,i,1)::int * (12 - i); END LOOP;
  r := (s * 10) % 11; IF r = 10 THEN r := 0; END IF;
  RETURN r = substr(d,11,1)::int;
END; $$;

CREATE OR REPLACE FUNCTION public.is_valid_cnpj(_v text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d text := regexp_replace(coalesce(_v,''), '\D', '', 'g');
  w1 int[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s int; r int; i int;
BEGIN
  IF length(d) <> 14 OR d ~ '^(\d)\1{13}$' THEN RETURN false; END IF;
  s := 0; FOR i IN 1..12 LOOP s := s + substr(d,i,1)::int * w1[i]; END LOOP;
  r := s % 11; r := CASE WHEN r < 2 THEN 0 ELSE 11 - r END;
  IF r <> substr(d,13,1)::int THEN RETURN false; END IF;
  s := 0; FOR i IN 1..13 LOOP s := s + substr(d,i,1)::int * w2[i]; END LOOP;
  r := s % 11; r := CASE WHEN r < 2 THEN 0 ELSE 11 - r END;
  RETURN r = substr(d,14,1)::int;
END; $$;

CREATE OR REPLACE FUNCTION public.is_valid_ie(_v text, _uf text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d text := regexp_replace(coalesce(_v,''), '\D', '', 'g'); n int := length(d);
BEGIN
  IF n = 0 OR d ~ '^(\d)\1+$' THEN RETURN false; END IF;
  RETURN CASE upper(_uf)
    WHEN 'AC' THEN n = 13 WHEN 'DF' THEN n = 13 WHEN 'MG' THEN n = 13
    WHEN 'BA' THEN n IN (8,9) WHEN 'RJ' THEN n = 8
    WHEN 'MT' THEN n = 11 WHEN 'PR' THEN n = 10 WHEN 'RS' THEN n = 10
    WHEN 'PE' THEN n IN (9,14) WHEN 'RN' THEN n IN (9,10) WHEN 'RO' THEN n IN (9,14) WHEN 'TO' THEN n IN (9,11)
    WHEN 'SP' THEN n = 12
    ELSE n = 9 END;
END; $$;

CREATE OR REPLACE FUNCTION public.validate_box_fiscal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d text := regexp_replace(coalesce(NEW.tax_id,''), '\D', '', 'g');
BEGIN
  -- Só valida quando os campos fiscais/categoria mudam (não trava alterações antigas do admin)
  IF TG_OP = 'UPDATE' AND NEW.tax_id = OLD.tax_id AND NEW.state_registration = OLD.state_registration
     AND NEW.main_category IS NOT DISTINCT FROM OLD.main_category AND NEW.state = OLD.state THEN
    RETURN NEW;
  END IF;
  IF NEW.main_category IS NULL THEN RAISE EXCEPTION 'Selecione a categoria de atuação'; END IF;

  IF length(d) = 11 THEN
    IF NEW.main_category <> 'plantas' THEN
      RAISE EXCEPTION 'A categoria % exige CNPJ ativo — cadastro com CPF não é permitido', NEW.main_category;
    END IF;
    IF NOT public.is_valid_cpf(d) THEN RAISE EXCEPTION 'CPF inválido'; END IF;
  ELSIF length(d) = 14 THEN
    IF NOT public.is_valid_cnpj(d) THEN RAISE EXCEPTION 'CNPJ inválido'; END IF;
  ELSE
    RAISE EXCEPTION 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido';
  END IF;
  NEW.tax_id := d;

  IF NEW.main_category = 'plantas' THEN
    IF NOT public.is_valid_ie(NEW.state_registration, NEW.state) THEN
      RAISE EXCEPTION 'Inscrição Estadual de Produtor Rural obrigatória e válida para a UF %', NEW.state;
    END IF;
  ELSIF regexp_replace(coalesce(NEW.state_registration,''), '\D', '', 'g') <> ''
        AND NOT public.is_valid_ie(NEW.state_registration, NEW.state) THEN
    RAISE EXCEPTION 'Inscrição Estadual inválida para a UF %', NEW.state;
  END IF;
  NEW.state_registration := regexp_replace(coalesce(NEW.state_registration,''), '\D', '', 'g');
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.validate_box_fiscal() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS boxes_validate_fiscal ON public.boxes;
CREATE TRIGGER boxes_validate_fiscal
  BEFORE INSERT OR UPDATE ON public.boxes
  FOR EACH ROW EXECUTE FUNCTION public.validate_box_fiscal();